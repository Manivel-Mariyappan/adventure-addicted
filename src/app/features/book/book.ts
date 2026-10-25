import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CatalogService } from '../../core/services/catalog.service';
import { ContentStore } from '../../core/services/content-store';
import { MyTripsService } from '../../core/services/my-trips.service';
import { SeoService } from '../../core/services/seo.service';
import { WhatsappService } from '../../core/services/whatsapp.service';
import { BookingRequest, Traveller, bookingMessage } from '../../core/utils/booking-message';
import { formatDate, formatRange } from '../../core/utils/dates';
import { formatInr } from '../../core/utils/price';
import {
  STATE_LABELS,
  departureState,
  newBookingRef,
  optionPrice,
  quote,
  seatsLeft,
} from '../../core/utils/trip-rules';
import { assetUrl } from '../../core/utils/url';
import { Icon } from '../../shared/icons';

const STEPS = ['Date', 'Travel option', 'Travellers', 'Details', 'Review'];
const MAX_PER_BOOKING = 10;

// 10-digit Indian mobile, with or without +91; null when it isn't one
function mobileDigits(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  return null;
}

@Component({
  selector: 'app-book',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, Icon],
  templateUrl: './book.html',
  styleUrl: './book.scss',
})
export class Book {
  private readonly catalog = inject(CatalogService);
  private readonly myTrips = inject(MyTripsService);
  private readonly whatsapp = inject(WhatsappService);
  readonly store = inject(ContentStore);
  readonly formatInr = formatInr;
  readonly formatDate = formatDate;
  readonly steps = STEPS;

  readonly slug = input.required<string>();
  // ?departure= from the tour page
  readonly departure = input<string>();

  readonly tour = computed(() => this.catalog.tour(this.slug()));
  readonly cover = computed(() => assetUrl(this.tour()?.coverImage ?? 'art/hero.svg'));

  readonly departures = computed(() => {
    const t = this.tour();
    if (!t) return [];
    return this.catalog
      .departuresOf(t.id)
      .map((d) => ({ d, state: departureState(d) }))
      .filter(({ state }) => state !== 'closed' && state !== 'cancelled' && state !== 'completed')
      .map(({ d, state }) => ({
        id: d.id,
        departure: d,
        state,
        label: STATE_LABELS[state],
        dates: formatRange(d.startDate, d.endDate),
        left: seatsLeft(d),
      }));
  });

  readonly step = signal(0);
  readonly submittedStep = signal(-1);
  readonly sentRef = signal<string | null>(null);

  readonly departureId = linkedSignal(() => {
    const wanted = this.departure();
    const list = this.departures();
    return list.find((x) => x.id === wanted)?.id ?? list.find((x) => x.left > 0)?.id ?? '';
  });
  readonly selected = computed(() => this.departures().find((x) => x.id === this.departureId()));

  readonly options = computed(() => {
    const t = this.tour();
    const sel = this.selected();
    if (!t || !sel) return [];
    return t.travelOptions
      .filter((o) => o.id in sel.departure.optionSeats)
      .map((o) => ({
        option: o,
        price: optionPrice(sel.departure, o),
        left: seatsLeft(sel.departure, o.id),
      }));
  });

  readonly optionId = linkedSignal(
    () => this.options().find((o) => o.left > 0)?.option.id ?? this.options()[0]?.option.id ?? '',
  );
  readonly chosen = computed(() => this.options().find((o) => o.option.id === this.optionId()));

  // a full departure or option becomes a waitlist request
  readonly waitlist = computed(() => (this.chosen()?.left ?? 0) === 0);
  readonly maxTravellers = computed(() =>
    this.waitlist() ? MAX_PER_BOOKING : Math.min(MAX_PER_BOOKING, this.chosen()?.left ?? 1),
  );

  readonly travellers = linkedSignal<number, number>({
    source: this.maxTravellers,
    computation: (max, previous) => Math.min(previous?.value ?? 1, max),
  });
  readonly addOns = signal<Record<string, number>>({});

  readonly lead = signal({ ...this.myTrips.profile() });
  readonly people = linkedSignal<number, Traveller[]>({
    source: this.travellers,
    computation: (count, previous) =>
      Array.from(
        { length: count },
        (_, i) =>
          previous?.value[i] ?? { name: i === 0 ? this.lead().name : '', age: null, gender: '' },
      ),
  });
  readonly notes = signal('');
  readonly accepted = signal(false);

  readonly quote = computed(() => {
    const t = this.tour();
    const sel = this.selected();
    const s = this.store.settings();
    if (!t || !sel || !s || !this.chosen()) return null;
    return quote({
      tour: t,
      departure: sel.departure,
      optionId: this.optionId(),
      travellers: this.travellers(),
      addOns: this.addOns(),
      gstPercent: s.gstPercent,
      advancePercent: s.advancePercent,
      balanceDueDays: s.balanceDueDays,
    });
  });

  readonly leadErrors = computed(() => {
    const l = this.lead();
    return {
      name: !l.name.trim(),
      phone: !mobileDigits(l.phone),
      email: !!l.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(l.email),
    };
  });
  readonly peopleErrors = computed(() =>
    this.people().map((p) => ({
      name: !p.name.trim(),
      age: p.age !== null && (p.age < 1 || p.age > 99),
    })),
  );

  readonly stepValid = computed(() => {
    switch (this.step()) {
      case 0:
        return !!this.selected();
      case 1:
        return !!this.chosen();
      case 2:
        return this.travellers() >= 1 && this.travellers() <= this.maxTravellers();
      case 3:
        return (
          !Object.values(this.leadErrors()).some(Boolean) &&
          !this.peopleErrors().some((e) => e.name || e.age)
        );
      default:
        return this.accepted();
    }
  });

  readonly showErrors = computed(() => this.submittedStep() >= this.step());

  constructor() {
    const seo = inject(SeoService);
    effect(() => {
      const t = this.tour();
      seo.set({
        title: t ? `Book ${t.name}` : 'Book a tour',
        description: 'Choose your date and travel option and send your booking request.',
      });
    });
  }

  next(): void {
    this.submittedStep.set(this.step());
    if (!this.stepValid()) return;
    this.step.update((s) => Math.min(s + 1, STEPS.length - 1));
    this.scrollTop();
  }

  back(): void {
    this.step.update((s) => Math.max(0, s - 1));
    this.scrollTop();
  }

  goTo(step: number): void {
    if (step < this.step()) this.step.set(step);
  }

  setTravellers(value: number): void {
    this.travellers.set(Math.max(1, Math.min(this.maxTravellers(), value)));
    // per-person add-ons can't exceed the group size
    this.addOns.update((a) =>
      Object.fromEntries(Object.entries(a).map(([k, v]) => [k, Math.min(v, this.travellers())])),
    );
  }

  qty(id: string): number {
    return this.addOns()[id] ?? 0;
  }

  setAddOn(id: string, qty: number): void {
    this.addOns.update((a) => ({ ...a, [id]: Math.max(0, qty) }));
  }

  updateLead(field: 'name' | 'phone' | 'email' | 'city', value: string): void {
    this.lead.update((l) => ({ ...l, [field]: value }));
  }

  updatePerson(index: number, patch: Partial<Traveller>): void {
    this.people.update((list) => list.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

  send(): void {
    this.submittedStep.set(this.step());
    const t = this.tour();
    const sel = this.selected();
    const q = this.quote();
    if (!this.stepValid() || !t || !sel || !q) return;

    const lead = { ...this.lead(), phone: mobileDigits(this.lead().phone)! };
    const request: BookingRequest = {
      ref: newBookingRef(),
      waitlist: this.waitlist(),
      tourCode: t.code,
      departureCode: sel.departure.code,
      startDate: sel.departure.startDate,
      endDate: sel.departure.endDate,
      optionId: this.optionId(),
      travellers: this.travellers(),
      addOns: Object.fromEntries(Object.entries(this.addOns()).filter(([, v]) => v > 0)),
      people: this.people().map((p) => ({ ...p, name: p.name.trim() })),
      lead,
      notes: this.notes().trim(),
      total: q.total,
      advance: q.advance,
    };

    this.myTrips.save({
      ...request,
      createdAt: new Date().toISOString(),
      priceLines: [
        ...q.lines,
        ...(q.gst ? [{ label: `GST ${this.store.settings()?.gstPercent}%`, amount: q.gst }] : []),
      ],
      cancelRequestedAt: null,
    });
    this.sentRef.set(request.ref);

    const url = this.whatsapp.link(bookingMessage(request, t));
    if (url) window.open(url, '_blank', 'noopener');
    this.scrollTop();
  }

  readonly resendHref = computed(() => {
    const ref = this.sentRef();
    const trip = ref ? this.myTrips.trip(ref) : undefined;
    const t = this.tour();
    return trip && t ? this.whatsapp.link(bookingMessage(trip, t)) : null;
  });

  private scrollTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
