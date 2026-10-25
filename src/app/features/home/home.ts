import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CatalogService } from '../../core/services/catalog.service';
import { ContentStore } from '../../core/services/content-store';
import { SeoService } from '../../core/services/seo.service';
import { formatMonth, formatRange } from '../../core/utils/dates';
import { formatInr } from '../../core/utils/price';
import { departureState, seatsLeft, startingPrice } from '../../core/utils/trip-rules';
import { assetUrl } from '../../core/utils/url';
import { DestinationCard } from '../../shared/destination-card';
import { Icon, IconName } from '../../shared/icons';
import { TourCard } from '../../shared/tour-card/tour-card';
import { WhatsappButton } from '../../shared/whatsapp-button';

@Component({
  selector: 'app-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, TourCard, DestinationCard, WhatsappButton],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  private readonly router = inject(Router);
  readonly catalog = inject(CatalogService);
  readonly settings = inject(ContentStore).settings;
  readonly formatMonth = formatMonth;

  readonly featured = computed(() =>
    this.catalog
      .tours()
      .filter((t) => t.featured)
      .slice(0, 6),
  );
  readonly regions = computed(() => this.catalog.regions().filter((d) => d.featured));

  readonly upcoming = computed(() =>
    this.catalog
      .openDepartures()
      .slice(0, 6)
      .map((d) => {
        const tour = this.catalog.tour(d.tourId)!;
        const left = seatsLeft(d);
        return {
          id: d.id,
          tour,
          image: assetUrl(tour.coverImage),
          dates: formatRange(d.startDate, d.endDate),
          left,
          filling: departureState(d) === 'filling',
          price: formatInr(startingPrice(tour, d)),
        };
      }),
  );

  readonly stats = computed(() => [
    { value: this.catalog.tours().length, label: 'guided tours' },
    { value: this.catalog.upcoming().length, label: 'upcoming departures' },
    { value: this.catalog.destinations().length, label: 'destinations' },
  ]);

  readonly reasons: { icon: IconName; title: string; text: string }[] = [
    {
      icon: 'user',
      title: 'A coordinator on every trip',
      text: 'One person who knows the route, the hotels and every traveller by name.',
    },
    {
      icon: 'shield',
      title: 'Backup vehicle and mechanic',
      text: 'Luggage, oxygen, first aid and spare parts follow the group every day.',
    },
    {
      icon: 'users',
      title: 'Small groups',
      text: 'Fixed departures of 14 to 20 people, so stops are quick and nobody is left behind.',
    },
    {
      icon: 'car',
      title: 'Ride, drive or sit back',
      text: 'Take one of our bikes, drive your own car in the convoy, or take a seat in our vehicle.',
    },
    {
      icon: 'altitude',
      title: 'Planned for the altitude',
      text: 'Rest days in Leh and a slow climb, so the high passes are fun and not frightening.',
    },
    {
      icon: 'doc',
      title: 'Clear prices',
      text: 'Per-person prices with GST, what is included, and a written cancellation policy.',
    },
  ];

  readonly faqs = computed(() => this.settings()?.faqs ?? []);
  readonly testimonials = computed(() => this.settings()?.testimonials ?? []);

  constructor() {
    inject(SeoService).set({
      title: 'Adventure Addicted | Bike expeditions and road trips in North India',
      description:
        'Guided bike expeditions and self-drive road trips to Ladakh, Kashmir, Spiti, Himachal, Uttarakhand and Rajasthan. Fixed departures, small groups, a coordinator on every trip.',
      path: '/',
    });
  }

  search(destination: string, month: string, travel: string): void {
    const queryParams = Object.fromEntries(
      Object.entries({ destination, month, travel }).filter(([, v]) => v),
    );
    void this.router.navigate(['/tours'], { queryParams });
  }
}
