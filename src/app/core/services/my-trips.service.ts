import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { BookingStatusEntry } from '../models';
import { BookingRequest, LeadContact } from '../utils/booking-message';
import { ContentStore } from './content-store';

const TRIPS_KEY = 'aac.my-trips';
const PROFILE_KEY = 'aac.profile';

export interface SavedTrip extends BookingRequest {
  createdAt: string;
  priceLines: { label: string; amount: number }[];
  cancelRequestedAt: string | null;
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // private browsing: works for this visit only
  }
}

// The customer's own booking requests and contact details, kept on their device.
// There are no customer accounts: the status comes from booking-status.json, by reference.
@Injectable({ providedIn: 'root' })
export class MyTripsService {
  private readonly store = inject(ContentStore);

  readonly trips = signal<SavedTrip[]>(read(TRIPS_KEY, []));
  readonly profile = signal<LeadContact>(
    read(PROFILE_KEY, { name: '', phone: '', email: '', city: '' }),
  );

  private readonly statusByRef = computed(
    () => new Map(this.store.bookingStatus().map((s) => [s.ref, s])),
  );

  constructor() {
    effect(() => write(TRIPS_KEY, this.trips()));
    effect(() => write(PROFILE_KEY, this.profile()));
  }

  status(ref: string): BookingStatusEntry | undefined {
    return this.statusByRef().get(ref);
  }

  trip(ref: string): SavedTrip | undefined {
    return this.trips().find((t) => t.ref === ref);
  }

  save(trip: SavedTrip): void {
    this.trips.update((list) => [trip, ...list.filter((t) => t.ref !== trip.ref)]);
    this.profile.set(trip.lead);
  }

  markCancelRequested(ref: string): void {
    const now = new Date().toISOString();
    this.trips.update((list) =>
      list.map((t) => (t.ref === ref ? { ...t, cancelRequestedAt: now } : t)),
    );
  }

  remove(ref: string): void {
    this.trips.update((list) => list.filter((t) => t.ref !== ref));
  }
}
