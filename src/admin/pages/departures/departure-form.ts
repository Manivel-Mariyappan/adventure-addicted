import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgbActiveOffcanvas, NgbDateStruct, NgbInputDatepicker } from '@ng-bootstrap/ng-bootstrap';
import { NgSelectComponent } from '@ng-select/ng-select';
import { Departure, DepartureStatus } from '../../../app/core/models';
import { ContentStore } from '../../../app/core/services/content-store';
import { addDays, todayIso } from '../../../app/core/utils/dates';
import { formatInr } from '../../../app/core/utils/price';
import { departureCode } from '../../../app/core/utils/trip-rules';
import { AdminDataService } from '../../core/admin-data.service';
import { AdminAlerts } from '../../core/alerts.service';
import { seatsTaken } from '../../core/ledger';
import { newId } from '../../core/local-collection';
import { fromStruct, toStruct } from '../../core/ngb-dates';
import { NumbersOnlyDirective } from '../../core/numbers-only.directive';
import { AdminCard } from '../../shared/admin-card';

@Component({
  selector: 'app-departure-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    NgSelectComponent,
    NgbInputDatepicker,
    NumbersOnlyDirective,
    AdminCard,
  ],
  templateUrl: './departure-form.html',
  host: { class: 'd-flex flex-column h-100' },
})
export class DepartureForm implements OnInit {
  private readonly store = inject(ContentStore);
  private readonly data = inject(AdminDataService);
  private readonly fb = inject(FormBuilder);
  private readonly alerts = inject(AdminAlerts);
  readonly offcanvas = inject(NgbActiveOffcanvas);
  readonly formatInr = formatInr;

  // null when scheduling a new one
  departure: Departure | null = null;

  readonly submitted = signal(false);
  readonly tours = computed(() =>
    this.store.tours().filter((t) => t.status !== 'archived' || t.id === this.departure?.tourId),
  );
  readonly coordinators = computed(() => this.store.coordinators().filter((c) => c.active));
  readonly statuses: { value: DepartureStatus; label: string }[] = [
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
  ];

  // travel option id -> seats / price for this date
  readonly seats = this.fb.nonNullable.record<string | number>({});
  readonly prices = this.fb.nonNullable.record<string | number>({});

  readonly form = this.fb.group({
    tourId: this.fb.control<string | null>(null, Validators.required),
    startDate: this.fb.control<NgbDateStruct | null>(null, Validators.required),
    totalSeats: this.fb.control<string | number>(16, Validators.required),
    coordinatorId: this.fb.control<string | null>(null),
    bookingClosesOn: this.fb.control<NgbDateStruct | null>(null),
    status: this.fb.nonNullable.control<DepartureStatus>('scheduled'),
    // per travel option: seats ('' = not offered) and price override ('' = tour price)
    seats: this.seats,
    prices: this.prices,
  });

  private readonly tourId = toSignal(this.form.controls.tourId.valueChanges, {
    initialValue: null,
  });
  private readonly start = toSignal(this.form.controls.startDate.valueChanges, {
    initialValue: null,
  });
  readonly tour = computed(() => this.store.tours().find((t) => t.id === this.tourId()));
  readonly preview = computed(() => {
    const t = this.tour();
    const start = fromStruct(this.start());
    if (!t || !start) return null;
    return { code: departureCode(t.code, start), end: addDays(start, t.days - 1) };
  });

  // seats already held by bookings, so the form can't go below them
  readonly taken = computed(() =>
    this.departure ? seatsTaken(this.data.bookings.all(), this.departure.id) : {},
  );

  ngOnInit(): void {
    this.form.controls.tourId.valueChanges.subscribe(() => this.buildOptionFields());
    const d = this.departure;
    if (d) {
      this.form.patchValue({
        tourId: d.tourId,
        startDate: toStruct(d.startDate),
        totalSeats: d.totalSeats,
        coordinatorId: d.coordinatorId,
        bookingClosesOn: toStruct(d.bookingClosesOn),
        status: d.status,
      });
      this.form.controls.tourId.disable();
    }
    // closing date defaults to a week before the start
    this.form.controls.startDate.valueChanges.subscribe((s) => {
      if (s && !this.form.controls.bookingClosesOn.dirty) {
        this.form.controls.bookingClosesOn.setValue(toStruct(addDays(fromStruct(s), -7)));
      }
    });
  }

  private buildOptionFields(): void {
    const t =
      this.tour() ?? this.store.tours().find((x) => x.id === this.form.controls.tourId.value);
    const seats = this.seats;
    const prices = this.prices;
    Object.keys(seats.controls).forEach((k) => seats.removeControl(k));
    Object.keys(prices.controls).forEach((k) => prices.removeControl(k));
    if (!t) return;
    const d = this.departure?.tourId === t.id ? this.departure : null;
    for (const o of t.travelOptions) {
      seats.addControl(
        o.id,
        this.fb.nonNullable.control<string | number>(d ? (d.optionSeats[o.id] ?? '') : ''),
      );
      prices.addControl(
        o.id,
        this.fb.nonNullable.control<string | number>(d ? (d.priceOverrides[o.id] ?? '') : ''),
      );
    }
    if (!d) this.form.controls.totalSeats.setValue(t.maxParticipants);
  }

  async save(): Promise<void> {
    this.submitted.set(true);
    this.form.markAllAsTouched();
    const v = this.form.getRawValue();
    const t = this.store.tours().find((x) => x.id === v.tourId);
    const start = fromStruct(v.startDate);
    if (!t || !start) {
      void this.alerts.error('Please check the form', 'Choose a tour and a start date.');
      return;
    }
    const total = Number(v.totalSeats) || 0;
    const optionSeats: Record<string, number> = {};
    const priceOverrides: Record<string, number> = {};
    for (const o of t.travelOptions) {
      const seats = v.seats[o.id];
      if (seats !== '' && seats !== undefined && Number(seats) > 0)
        optionSeats[o.id] = Number(seats);
      const price = v.prices[o.id];
      if (price !== '' && price !== undefined && Number(price) > 0)
        priceOverrides[o.id] = Number(price);
    }
    const problems: string[] = [];
    if (total < 1) problems.push('Total seats must be at least 1.');
    if (!Object.keys(optionSeats).length)
      problems.push('Enter seats for at least one travel option.');
    if (Object.values(optionSeats).some((s) => s > total))
      problems.push('A travel option cannot have more seats than the group total.');
    const takenTotal = Object.values(this.taken()).reduce((a, b) => a + b, 0);
    if (total < takenTotal)
      problems.push(`${takenTotal} seats are already booked, so total seats cannot be lower.`);
    for (const [id, n] of Object.entries(this.taken())) {
      if ((optionSeats[id] ?? 0) < n)
        problems.push(
          `${n} seats are booked on "${t.travelOptions.find((o) => o.id === id)?.label ?? id}".`,
        );
    }
    if (!this.departure && start < todayIso())
      problems.push('The start date cannot be in the past.');
    if (problems.length) {
      void this.alerts.error('Please check the form', problems.join(' '));
      return;
    }

    const code = departureCode(t.code, start);
    if (this.store.departures().some((d) => d.code === code && d.id !== this.departure?.id)) {
      void this.alerts.error(
        'Departure already exists',
        `${t.name} already has a departure on this date (${code}).`,
      );
      return;
    }
    if (this.departure && !(await this.alerts.confirm('Update this departure?', code))) return;

    const record: Departure = {
      id: this.departure?.id ?? newId('dep'),
      code,
      tourId: t.id,
      startDate: start,
      endDate: addDays(start, t.days - 1),
      totalSeats: total,
      optionSeats,
      priceOverrides,
      seatsTaken: this.departure?.seatsTaken ?? {},
      coordinatorId: v.coordinatorId,
      bookingClosesOn: fromStruct(v.bookingClosesOn) || addDays(start, -7),
      status: v.status,
    };
    this.store.saveDraft(
      'departures',
      this.departure
        ? this.store.departures().map((d) => (d.id === record.id ? record : d))
        : [...this.store.departures(), record],
    );
    this.offcanvas.close(record);
    void this.alerts.success(this.departure ? 'Departure updated' : 'Departure scheduled', code);
  }
}
