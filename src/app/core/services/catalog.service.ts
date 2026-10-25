import { Injectable, computed, inject } from '@angular/core';
import { Coordinator, Departure, Destination, TourPackage, TravelType } from '../models';
import { todayIso } from '../utils/dates';
import { departureState, isBookable, seatsLeft, startingPrice } from '../utils/trip-rules';
import { ContentStore } from './content-store';

export type TourSort = 'date' | 'price-asc' | 'price-desc' | 'duration';

export interface TourFilters {
  destination?: string | null;
  month?: string | null;
  minDays?: number | null;
  maxDays?: number | null;
  maxPrice?: number | null;
  travel?: TravelType | null;
  flights?: 'included' | 'land' | null;
  seatsOnly?: boolean;
  search?: string | null;
  sort?: TourSort;
}

const byOrder = (a: Destination, b: Destination) =>
  a.displayOrder - b.displayOrder || a.name.localeCompare(b.name);

@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly store = inject(ContentStore);

  readonly state = this.store.state;
  readonly reload = () => this.store.load();

  readonly destinations = computed(() =>
    this.store
      .destinations()
      .filter((d) => d.active)
      .sort(byOrder),
  );
  readonly regions = computed(() => this.destinations().filter((d) => !d.parentId));

  readonly tours = computed(() => this.store.tours().filter((t) => t.status === 'published'));

  // upcoming departures of published tours, soonest first
  readonly upcoming = computed(() => {
    const today = todayIso();
    const published = new Set(this.tours().map((t) => t.id));
    return this.store
      .departures()
      .filter((d) => published.has(d.tourId) && d.status === 'scheduled' && d.startDate >= today)
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
  });

  // departures customers can book right now
  readonly openDepartures = computed(() =>
    this.upcoming().filter((d) => isBookable(departureState(d))),
  );

  readonly coordinators = computed(() => this.store.coordinators().filter((c) => c.active));

  tour(slugOrId: string): TourPackage | undefined {
    return this.tours().find((t) => t.slug === slugOrId || t.id === slugOrId);
  }

  destination(slug: string): Destination | undefined {
    return this.destinations().find((d) => d.slug === slug);
  }

  destinationById(id: string): Destination | undefined {
    return this.destinations().find((d) => d.id === id);
  }

  children(destination: Destination): Destination[] {
    return this.destinations().filter((d) => d.parentId === destination.id);
  }

  departuresOf(tourId: string): Departure[] {
    return this.upcoming().filter((d) => d.tourId === tourId);
  }

  departure(idOrCode: string): Departure | undefined {
    return this.store.departures().find((d) => d.id === idOrCode || d.code === idOrCode);
  }

  nextDeparture(tourId: string): Departure | undefined {
    const list = this.departuresOf(tourId);
    return list.find((d) => isBookable(departureState(d))) ?? list[0];
  }

  coordinator(id: string | null): Coordinator | undefined {
    return id ? this.coordinators().find((c) => c.id === id) : undefined;
  }

  // a region also lists the tours of its places (Ladakh includes Leh, Nubra, Pangong...)
  toursFor(destination: Destination): TourPackage[] {
    const ids = new Set([destination.id, ...this.children(destination).map((d) => d.id)]);
    return this.tours().filter((t) => t.destinationIds.some((id) => ids.has(id)));
  }

  destinationsOf(tour: TourPackage): Destination[] {
    return tour.destinationIds
      .map((id) => this.destinationById(id))
      .filter((d): d is Destination => !!d);
  }

  fromPrice(tour: TourPackage): number {
    const next = this.nextDeparture(tour.id);
    return startingPrice(tour, next ?? null);
  }

  seatsLeftOn(tour: TourPackage): number {
    return this.departuresOf(tour.id)
      .filter((d) => isBookable(departureState(d)))
      .reduce((sum, d) => sum + seatsLeft(d), 0);
  }

  search(f: TourFilters): TourPackage[] {
    const term = f.search?.trim().toLowerCase();
    const destination = f.destination ? this.destination(f.destination) : undefined;
    const inDestination = destination ? new Set(this.toursFor(destination).map((t) => t.id)) : null;

    const list = this.tours().filter((t) => {
      if (inDestination && !inDestination.has(t.id)) return false;
      if (f.minDays && t.days < f.minDays) return false;
      if (f.maxDays && t.days > f.maxDays) return false;
      if (f.travel && !t.travelOptions.some((o) => o.type === f.travel)) return false;
      if (f.flights === 'included' && !t.flightsIncluded) return false;
      if (f.flights === 'land' && t.flightsIncluded) return false;
      if (f.maxPrice && this.fromPrice(t) > f.maxPrice) return false;
      const departures = this.departuresOf(t.id).filter(
        (d) => !f.month || d.startDate.startsWith(f.month),
      );
      if (f.month && !departures.length) return false;
      if (f.seatsOnly && !departures.some((d) => isBookable(departureState(d)))) return false;
      if (term) {
        const places = this.destinationsOf(t).map((d) => d.name);
        const text = [t.name, t.tagline, t.summary, ...t.route, ...places].join(' ').toLowerCase();
        if (!text.includes(term)) return false;
      }
      return true;
    });

    const next = (t: TourPackage) => this.nextDeparture(t.id)?.startDate ?? '9999';
    switch (f.sort) {
      case 'price-asc':
        return list.sort((a, b) => this.fromPrice(a) - this.fromPrice(b));
      case 'price-desc':
        return list.sort((a, b) => this.fromPrice(b) - this.fromPrice(a));
      case 'duration':
        return list.sort((a, b) => a.days - b.days);
      default:
        return list.sort((a, b) => next(a).localeCompare(next(b)));
    }
  }

  // months that have departures, for the date filter: ['2027-05', '2027-06', ...]
  readonly months = computed(() => [
    ...new Set(this.upcoming().map((d) => d.startDate.slice(0, 7))),
  ]);
}
