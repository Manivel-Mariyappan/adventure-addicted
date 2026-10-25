import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { merge } from 'rxjs';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgbActiveOffcanvas, NgbDateStruct, NgbInputDatepicker } from '@ng-bootstrap/ng-bootstrap';
import { NgSelectComponent } from '@ng-select/ng-select';
import { BookingStatus } from '../../../app/core/models';
import { ContentStore } from '../../../app/core/services/content-store';
import { whatsappUrl } from '../../../app/core/services/whatsapp.service';
import { parseBookingMessage } from '../../../app/core/utils/booking-message';
import { formatDate, formatRange, todayIso } from '../../../app/core/utils/dates';
import { formatInr, roundMoney } from '../../../app/core/utils/price';
import {
  cancellationEstimate,
  newBookingRef,
  optionPrice,
  quote,
  seatsLeft,
} from '../../../app/core/utils/trip-rules';
import { AdminDataService } from '../../core/admin-data.service';
import {
  Booking,
  BookingSource,
  Passenger,
  PaymentEntry,
  PaymentMethod,
} from '../../core/admin-models';
import { AdminAlerts } from '../../core/alerts.service';
import { paidOf, withLiveSeats } from '../../core/ledger';
import { newId } from '../../core/local-collection';
import { fromStruct, toStruct } from '../../core/ngb-dates';
import { NumbersOnlyDirective } from '../../core/numbers-only.directive';
import { AdminCard } from '../../shared/admin-card';

export const BOOKING_STATUSES: BookingStatus[] = [
  'Requested',
  'Pending payment',
  'Confirmed',
  'Waitlisted',
  'Cancelled',
  'Refund pending',
  'Completed',
];
const SOURCES: BookingSource[] = ['Website', 'WhatsApp', 'Phone call', 'Walk-in'];
const METHODS: PaymentMethod[] = ['UPI', 'Bank transfer', 'Cash', 'Card', 'Other'];
const HOLDING: BookingStatus[] = ['Requested', 'Pending payment', 'Confirmed', 'Completed'];

@Component({
  selector: 'app-booking-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    NgSelectComponent,
    NgbInputDatepicker,
    NumbersOnlyDirective,
    AdminCard,
  ],
  templateUrl: './booking-form.html',
  host: { class: 'd-flex flex-column h-100' },
})
export class BookingForm implements OnInit {
  private readonly store = inject(ContentStore);
  private readonly data = inject(AdminDataService);
  private readonly fb = inject(FormBuilder);
  private readonly alerts = inject(AdminAlerts);
  readonly offcanvas = inject(NgbActiveOffcanvas);
  readonly formatInr = formatInr;
  readonly formatDate = formatDate;

  // null when adding
  booking: Booking | null = null;
  // set when opened from a departure's bookings
  presetDepartureId: string | null = null;

  readonly statuses = BOOKING_STATUSES;
  readonly sources = SOURCES;
  readonly methods = METHODS;
  readonly submitted = signal(false);
  readonly pasted = signal('');
  readonly pasteResult = signal<{ ok: boolean; text: string } | null>(null);
  // keep the original price lines unless the trip changes or Recalculate is pressed
  readonly keepSnapshot = signal(false);

  // add-on id -> quantity; the add-ons depend on the departure's tour
  readonly addOnQty = this.fb.nonNullable.record<string | number>({});

  readonly form = this.fb.group({
    ref: this.fb.nonNullable.control(''),
    source: this.fb.nonNullable.control<BookingSource>('WhatsApp'),
    departureId: this.fb.control<string | null>(null, Validators.required),
    optionId: this.fb.control<string | null>(null, Validators.required),
    travellers: this.fb.nonNullable.control<string | number>(1),
    addOns: this.addOnQty,
    lead: this.fb.nonNullable.group({
      name: ['', Validators.required],
      phone: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
      email: ['', Validators.email],
      city: [''],
    }),
    passengers: this.fb.array<ReturnType<BookingForm['passengerGroup']>>([]),
    notes: this.fb.nonNullable.control(''),
    discount: this.fb.nonNullable.control<string | number>(''),
    discountNote: this.fb.nonNullable.control(''),
    status: this.fb.nonNullable.control<BookingStatus>('Requested'),
    holdUntil: this.fb.control<NgbDateStruct | null>(null),
    cancelReason: this.fb.nonNullable.control(''),
    payments: this.fb.array<ReturnType<BookingForm['paymentGroup']>>([]),
  });

  private readonly value = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  readonly departures = computed(() => {
    const tours = new Map(this.store.tours().map((t) => [t.id, t]));
    const today = todayIso();
    return this.store
      .departures()
      .filter(
        (d) =>
          (d.status === 'scheduled' && d.endDate >= today) || d.id === this.booking?.departureId,
      )
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
      .map((d) => {
        const live = withLiveSeats(d, this.otherBookings());
        return {
          id: d.id,
          label: `${d.code} · ${tours.get(d.tourId)?.name ?? ''} · ${formatRange(d.startDate, d.endDate)} · ${seatsLeft(live)} left`,
        };
      });
  });

  // every booking except this one, so its own seats don't count against it
  private readonly otherBookings = computed(() =>
    this.data.bookings.all().filter((b) => b.id !== this.booking?.id),
  );

  readonly departure = computed(() =>
    this.store.departures().find((d) => d.id === this.value().departureId),
  );
  readonly tour = computed(() => this.store.tours().find((t) => t.id === this.departure()?.tourId));
  readonly liveDeparture = computed(() => {
    const d = this.departure();
    return d ? withLiveSeats(d, this.otherBookings()) : null;
  });
  readonly options = computed(() => {
    const t = this.tour();
    const d = this.liveDeparture();
    if (!t || !d) return [];
    return t.travelOptions
      .filter((o) => o.id in d.optionSeats)
      .map((o) => ({
        id: o.id,
        label: `${o.label} · ${formatInr(optionPrice(d, o))} · ${seatsLeft(d, o.id)} left`,
        left: seatsLeft(d, o.id),
      }));
  });
  readonly seatsAvailable = computed(
    () => this.options().find((o) => o.id === this.value().optionId)?.left ?? 0,
  );

  readonly quote = computed(() => {
    const v = this.value();
    const t = this.tour();
    const d = this.departure();
    const s = this.store.settings();
    if (!t || !d || !s || !v.optionId || !t.travelOptions.some((o) => o.id === v.optionId))
      return null;
    return quote({
      tour: t,
      departure: d,
      optionId: v.optionId,
      travellers: Math.max(1, Number(v.travellers) || 1),
      addOns: Object.fromEntries(
        Object.entries(v.addOns ?? {}).map(([k, q]) => [k, Number(q) || 0]),
      ),
      discount: Number(v.discount) || 0,
      gstPercent: s.gstPercent,
      advancePercent: s.advancePercent,
      balanceDueDays: s.balanceDueDays,
    });
  });

  // what the booking costs: the saved snapshot, or a fresh quote
  readonly price = computed(() => {
    const b = this.booking;
    if (b && this.keepSnapshot()) {
      return {
        lines: b.priceLines,
        discount: b.discount,
        gst: b.gst,
        total: b.total,
        snapshot: true,
      };
    }
    const q = this.quote();
    return q
      ? { lines: q.lines, discount: q.discount, gst: q.gst, total: q.total, snapshot: false }
      : null;
  });

  readonly paid = computed(() =>
    roundMoney(
      (this.value().payments ?? []).reduce(
        (s, p) => s + (p.kind === 'refund' ? -1 : 1) * (Number(p.amount) || 0),
        0,
      ),
    ),
  );

  readonly refundEstimate = computed(() => {
    const t = this.tour();
    const d = this.departure();
    return t && d ? cancellationEstimate(t.cancellationPolicy, d.startDate, this.paid()) : null;
  });

  readonly leadWhatsapp = computed(() => {
    const phone = this.value().lead?.phone ?? '';
    if (!/^\d{10}$/.test(phone)) return null;
    const ref = this.value().ref;
    const total = this.price()?.total ?? 0;
    const due = roundMoney(total - this.paid());
    const status = this.value().status;
    const text =
      status === 'Confirmed'
        ? `Hello ${this.value().lead?.name}, your booking ${ref} is confirmed. Paid ${formatInr(this.paid())}${due > 0 ? `, balance ${formatInr(due)}` : ''}. Thank you!`
        : `Hello ${this.value().lead?.name}, about your booking ${ref}: the amount due is ${formatInr(Math.max(0, due))}.`;
    return whatsappUrl(`91${phone}`, text);
  });

  private passengerGroup(p?: Partial<Passenger>) {
    return this.fb.nonNullable.group({
      name: [p?.name ?? '', Validators.required],
      age: this.fb.control<string | number | null>(p?.age ?? null),
      gender: this.fb.nonNullable.control<Passenger['gender']>(p?.gender ?? ''),
      phone: [p?.phone ?? ''],
      emergencyName: [p?.emergencyName ?? ''],
      emergencyPhone: [p?.emergencyPhone ?? ''],
      notes: [p?.notes ?? ''],
      idChecked: [p?.idChecked ?? false],
    });
  }

  private paymentGroup(p?: Partial<Omit<PaymentEntry, 'amount'>> & { amount?: number | string }) {
    return this.fb.nonNullable.group({
      id: [p?.id ?? newId('pay')],
      date: this.fb.control<NgbDateStruct | null>(toStruct(p?.date ?? todayIso())),
      kind: this.fb.nonNullable.control<PaymentEntry['kind']>(p?.kind ?? 'payment'),
      amount: this.fb.nonNullable.control<string | number>(p?.amount ?? '', Validators.required),
      method: this.fb.nonNullable.control<PaymentMethod>(p?.method ?? 'UPI'),
      reference: [p?.reference ?? ''],
      note: [p?.note ?? ''],
    });
  }

  ngOnInit(): void {
    // travel options and add-ons depend on the departure
    this.form.controls.departureId.valueChanges.subscribe(() => {
      if (!this.tour()?.travelOptions.some((o) => o.id === this.form.controls.optionId.value)) {
        this.form.controls.optionId.setValue(this.options().find((o) => o.left > 0)?.id ?? null);
      }
      this.buildAddOns();
    });
    // the passenger list follows the number of travellers
    this.form.controls.travellers.valueChanges.subscribe((n) =>
      this.syncPassengers(Number(n) || 1),
    );

    const b = this.booking;
    if (b) {
      this.keepSnapshot.set(true);
      this.form.patchValue({
        ref: b.ref,
        source: b.source,
        departureId: b.departureId,
        optionId: b.optionId,
        travellers: b.travellers,
        lead: b.lead,
        notes: b.notes,
        discount: b.discount || '',
        discountNote: b.discountNote,
        status: b.status,
        holdUntil: toStruct(b.holdUntil),
        cancelReason: b.cancelReason,
      });
      this.buildAddOns(b.addOns);
      this.form.controls.passengers.clear();
      b.passengers.forEach((p) => this.form.controls.passengers.push(this.passengerGroup(p)));
      b.payments.forEach((p) => this.form.controls.payments.push(this.paymentGroup(p)));
      // a changed trip means a new price
      const c = this.form.controls;
      merge(
        c.departureId.valueChanges,
        c.optionId.valueChanges,
        c.travellers.valueChanges,
        c.discount.valueChanges,
        this.addOnQty.valueChanges,
      ).subscribe(() => this.keepSnapshot.set(false));
    } else {
      this.form.controls.ref.setValue(newBookingRef());
      if (this.presetDepartureId) this.form.controls.departureId.setValue(this.presetDepartureId);
      this.syncPassengers(1);
      this.setHold();
    }
  }

  private buildAddOns(values: Record<string, number> = {}): void {
    const group = this.addOnQty;
    Object.keys(group.controls).forEach((k) => group.removeControl(k, { emitEvent: false }));
    for (const a of this.tour()?.addOns ?? []) {
      group.addControl(a.id, this.fb.nonNullable.control<string | number>(values[a.id] ?? 0), {
        emitEvent: false,
      });
    }
  }

  private syncPassengers(count: number): void {
    const list = this.form.controls.passengers;
    while (list.length < count) list.push(this.passengerGroup());
    while (list.length > count && list.length > 1) list.removeAt(list.length - 1);
  }

  setHold(): void {
    const hours = this.store.settings()?.holdHours ?? 48;
    const until = new Date(Date.now() + hours * 3_600_000);
    this.form.controls.holdUntil.setValue(toStruct(until.toISOString()));
  }

  addPayment(kind: PaymentEntry['kind'] = 'payment'): void {
    const due = roundMoney((this.price()?.total ?? 0) - this.paid());
    const advance = this.quote()?.advance ?? 0;
    const amount =
      kind === 'refund'
        ? (this.refundEstimate()?.refund ?? '')
        : this.paid() === 0 && advance
          ? advance
          : Math.max(0, due);
    this.form.controls.payments.push(
      this.paymentGroup({
        kind,
        amount,
        note: kind === 'refund' ? 'Refund' : this.paid() === 0 ? 'Advance' : 'Balance',
      }),
    );
  }

  readMessage(): void {
    const parsed = parseBookingMessage(this.pasted());
    if (!parsed) {
      this.pasteResult.set({
        ok: false,
        text: 'No booking reference (AAC-...) found. Paste the whole message.',
      });
      return;
    }
    const departure = this.store.departures().find((d) => d.code === parsed.departureCode);
    if (!departure) {
      this.pasteResult.set({
        ok: false,
        text: `Departure ${parsed.departureCode || '?'} isn't scheduled. Check the tour's dates.`,
      });
      return;
    }
    const duplicate = this.data.bookings.all().find((b) => b.ref === parsed.ref);
    if (duplicate) {
      this.pasteResult.set({
        ok: false,
        text: `${parsed.ref} is already saved (${duplicate.lead.name}, ${duplicate.status}).`,
      });
      return;
    }
    this.form.patchValue({
      ref: parsed.ref,
      source: 'Website',
      departureId: departure.id,
      lead: parsed.lead,
      notes: parsed.notes,
      status: parsed.waitlist ? 'Waitlisted' : 'Requested',
    });
    this.form.controls.optionId.setValue(parsed.optionId);
    this.form.controls.travellers.setValue(parsed.travellers);
    const addOns = this.tour()?.addOns ?? [];
    this.buildAddOns(
      Object.fromEntries(
        Object.entries(parsed.addOnLabels)
          .map(([label, qty]) => [addOns.find((a) => a.label === label)?.id, qty])
          .filter(([id]) => id),
      ),
    );
    this.form.controls.passengers.clear();
    parsed.people.forEach((p) => this.form.controls.passengers.push(this.passengerGroup(p)));
    this.syncPassengers(parsed.travellers);
    if (!parsed.waitlist) this.setHold();
    this.pasteResult.set({
      ok: true,
      text: `Filled in ${parsed.ref} for ${parsed.lead.name}: ${parsed.travellers} traveller(s) on ${departure.code}.`,
    });
  }

  invalidLead(name: 'name' | 'phone' | 'email'): boolean {
    const c = this.form.controls.lead.controls[name];
    return c.invalid && (c.touched || this.submitted());
  }

  async save(): Promise<void> {
    this.submitted.set(true);
    this.form.markAllAsTouched();
    const v = this.form.getRawValue();
    const price = this.price();
    if (this.form.invalid || !price) {
      void this.alerts.error(
        'Please check the form',
        'Departure, travel option, lead name, a 10-digit phone and every traveller name are needed. Payments need an amount.',
      );
      return;
    }
    const travellers = Math.max(1, Number(v.travellers) || 1);
    let status = v.status;
    const holdUntilIso = v.holdUntil ? `${fromStruct(v.holdUntil)}T23:59:59.000+05:30` : null;
    const wouldHold =
      HOLDING.includes(status) &&
      (status === 'Confirmed' ||
        status === 'Completed' ||
        (!!holdUntilIso && new Date(holdUntilIso).toISOString() > new Date().toISOString()));
    if (wouldHold && travellers > this.seatsAvailable()) {
      const ok = await this.alerts.confirm(
        'Not enough seats',
        `Only ${this.seatsAvailable()} seat(s) left on this option. Save it as Waitlisted instead?`,
        'Save as waitlisted',
        'warning',
      );
      if (!ok) return;
      status = 'Waitlisted';
    }
    if (this.booking && !(await this.alerts.confirm('Save changes to this booking?', v.ref)))
      return;

    const now = new Date().toISOString();
    const history = [...(this.booking?.history ?? [])];
    if (!this.booking) history.push({ at: now, text: `Created (${v.source})` });
    else if (this.booking.status !== status)
      history.push({ at: now, text: `${this.booking.status} → ${status}` });
    const paidBefore = this.booking ? paidOf(this.booking) : 0;
    if (this.paid() !== paidBefore)
      history.push({
        at: now,
        text: `Paid ${formatInr(this.paid())} of ${formatInr(price.total)}`,
      });

    const record: Booking = {
      id: this.booking?.id ?? newId('bkg'),
      ref: v.ref,
      createdAt: this.booking?.createdAt ?? now,
      updatedAt: now,
      source: v.source,
      tourId: this.tour()!.id,
      departureId: v.departureId!,
      optionId: v.optionId!,
      travellers,
      addOns: Object.fromEntries(
        Object.entries(v.addOns)
          .map(([k, q]) => [k, Number(q) || 0])
          .filter(([, q]) => q),
      ),
      lead: { ...v.lead, name: v.lead.name.trim() },
      passengers: v.passengers.map((p) => ({
        ...p,
        name: p.name.trim(),
        age: p.age === null || p.age === '' ? null : Number(p.age),
      })),
      notes: v.notes.trim(),
      priceLines: price.lines,
      discount: price.discount,
      discountNote: v.discountNote.trim(),
      gst: price.gst,
      total: price.total,
      status,
      holdUntil:
        ['Requested', 'Pending payment'].includes(status) && holdUntilIso
          ? new Date(holdUntilIso).toISOString()
          : null,
      payments: v.payments.map((p) => ({
        ...p,
        date: fromStruct(p.date) || todayIso(),
        amount: Number(p.amount) || 0,
      })),
      cancelReason: v.cancelReason.trim(),
      history,
      demo: this.booking?.demo ?? false,
    };
    this.data.bookings.upsert(record);
    this.offcanvas.close(record);
    void this.alerts.success(
      this.booking ? 'Booking saved' : 'Booking added',
      `${record.ref} · ${record.status}`,
    );
  }

  async remove(): Promise<void> {
    const b = this.booking;
    if (!b) return;
    if (
      !(await this.alerts.confirmDelete(
        `Delete ${b.ref}?`,
        'Use Cancelled instead to keep a record. Deleting removes it completely.',
      ))
    )
      return;
    this.data.bookings.remove(b.id);
    this.offcanvas.close();
    void this.alerts.toast('Booking deleted');
  }
}
