import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CatalogService } from '../../core/services/catalog.service';
import { MyTripsService } from '../../core/services/my-trips.service';
import { SeoService } from '../../core/services/seo.service';
import { formatRange, todayIso } from '../../core/utils/dates';
import { formatInr } from '../../core/utils/price';
import { STATUS_TONE } from '../../core/utils/status-tone';
import { assetUrl } from '../../core/utils/url';
import { Icon } from '../../shared/icons';

@Component({
  selector: 'app-my-trips',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon],
  templateUrl: './my-trips.html',
  styleUrl: './my-trips.scss',
})
export class MyTrips {
  private readonly catalog = inject(CatalogService);
  readonly myTrips = inject(MyTripsService);
  readonly formatInr = formatInr;
  readonly tones = STATUS_TONE;

  readonly lookup = signal('');
  readonly lookedUp = signal(false);

  readonly cards = computed(() => {
    const today = todayIso();
    return this.myTrips.trips().map((trip) => {
      const tour = this.catalog.tours().find((t) => t.code === trip.tourCode);
      const status = this.myTrips.status(trip.ref);
      return {
        trip,
        tourName: tour?.name ?? trip.tourCode,
        image: assetUrl(tour?.coverImage ?? 'art/hero.svg'),
        dates: formatRange(trip.startDate, trip.endDate),
        past: trip.endDate < today,
        status: status?.status ?? (trip.waitlist ? 'Waitlisted' : 'Requested'),
        paid: status?.paid ?? 0,
        total: status?.total ?? trip.total,
      };
    });
  });
  readonly upcoming = computed(() => this.cards().filter((c) => !c.past));
  readonly past = computed(() => this.cards().filter((c) => c.past));

  readonly found = computed(() => {
    const ref = this.lookup().trim().toUpperCase();
    return ref ? this.myTrips.status(ref.startsWith('AAC-') ? ref : `AAC-${ref}`) : undefined;
  });

  constructor() {
    inject(SeoService).set({
      title: 'My trips',
      description: 'Your booking requests, their status and payments.',
      path: '/my-trips',
    });
  }
}
