import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TravelType } from '../../core/models';
import { CatalogService, TourSort } from '../../core/services/catalog.service';
import { SeoService } from '../../core/services/seo.service';
import { enquiryMessages } from '../../core/services/whatsapp.service';
import { formatMonth } from '../../core/utils/dates';
import { Icon } from '../../shared/icons';
import { TourCard } from '../../shared/tour-card/tour-card';
import { WhatsappButton } from '../../shared/whatsapp-button';

const DURATIONS = [
  { key: 'short', label: 'Up to 5 days', min: null, max: 5 },
  { key: 'week', label: '6 to 8 days', min: 6, max: 8 },
  { key: 'long', label: '9 days or more', min: 9, max: null },
];
const PRICES = [20000, 30000, 40000, 50000];
const TRAVEL: { key: TravelType; label: string; icon: 'bike' | 'car' | 'users' }[] = [
  { key: 'bike', label: 'Bike', icon: 'bike' },
  { key: 'own-car', label: 'Own car', icon: 'car' },
  { key: 'vehicle', label: 'Seat in our vehicle', icon: 'users' },
];

@Component({
  selector: 'app-tours',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, TourCard, WhatsappButton],
  templateUrl: './tours.html',
  styleUrl: './tours.scss',
})
export class Tours {
  private readonly router = inject(Router);
  readonly catalog = inject(CatalogService);

  // query params, bound by withComponentInputBinding()
  readonly destination = input<string>();
  readonly month = input<string>();
  readonly days = input<string>();
  readonly price = input<string>();
  readonly travel = input<string>();
  readonly flights = input<string>();
  readonly seats = input<string>();
  readonly q = input<string>();
  readonly sort = input<string>();

  readonly durations = DURATIONS;
  readonly prices = PRICES;
  readonly travelTypes = TRAVEL;
  readonly formatMonth = formatMonth;
  readonly sorts: { key: TourSort; label: string }[] = [
    { key: 'date', label: 'Next departure' },
    { key: 'price-asc', label: 'Price: low to high' },
    { key: 'price-desc', label: 'Price: high to low' },
    { key: 'duration', label: 'Shortest first' },
  ];

  readonly place = computed(() => this.catalog.destination(this.destination() ?? ''));

  readonly results = computed(() => {
    const duration = DURATIONS.find((d) => d.key === this.days());
    return this.catalog.search({
      destination: this.destination() ?? null,
      month: this.month() ?? null,
      minDays: duration?.min ?? null,
      maxDays: duration?.max ?? null,
      maxPrice: this.price() ? Number(this.price()) : null,
      travel: (this.travel() as TravelType | undefined) ?? null,
      flights: (this.flights() as 'included' | 'land' | undefined) ?? null,
      seatsOnly: !!this.seats(),
      search: this.q() ?? null,
      sort: (this.sort() as TourSort | undefined) ?? 'date',
    });
  });

  readonly title = computed(() => {
    const travel = this.travel();
    const base =
      travel === 'bike'
        ? 'Bike expeditions'
        : travel === 'own-car'
          ? 'Self-drive road trips'
          : 'Tours';
    return this.place()
      ? `${base} in ${this.place()!.name}`
      : base === 'Tours'
        ? 'All tours'
        : base;
  });

  readonly hasFilters = computed(() =>
    [
      this.destination(),
      this.month(),
      this.days(),
      this.price(),
      this.travel(),
      this.flights(),
      this.seats(),
      this.q(),
    ].some(Boolean),
  );

  readonly enquiry = computed(() =>
    this.place()
      ? enquiryMessages.destination(this.place()!.name)
      : 'Hello, I am looking for a tour. Can you suggest one?',
  );

  constructor() {
    const seo = inject(SeoService);
    effect(() =>
      seo.set({
        title: this.title(),
        description:
          'Fixed-departure bike expeditions and road trips to Ladakh, Kashmir, Spiti, Himachal, Uttarakhand and Rajasthan, with seats left and prices.',
        path: '/tours',
      }),
    );
  }

  set(params: Record<string, string | number | null>): void {
    void this.router.navigate([], {
      queryParams: params,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  clear(): void {
    void this.router.navigate(['/tours'], { replaceUrl: true });
  }
}
