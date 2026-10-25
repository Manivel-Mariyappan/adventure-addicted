import { Injectable, computed } from '@angular/core';
import { CompanySettings, Departure, TourPackage } from '../../app/core/models';
import { addDays, toIsoDate } from '../../app/core/utils/dates';
import { quote } from '../../app/core/utils/trip-rules';
import { AdminUser, Booking, DepartureOps } from './admin-models';
import { LocalCollection } from './local-collection';

const now = () => new Date().toISOString();

// localStorage stand-ins until the API exists
@Injectable({ providedIn: 'root' })
export class AdminDataService {
  readonly users = new LocalCollection<AdminUser>('aac.admin.users', () => [
    {
      id: 'usr-owner',
      fullName: 'Company Owner',
      username: 'admin',
      email: '',
      mobile: '',
      role: 'Owner',
      active: true,
      lastLogin: null,
      createdAt: now(),
    },
  ]);

  readonly bookings = new LocalCollection<Booking>('aac.admin.bookings', () => []);
  readonly ops = new LocalCollection<DepartureOps>('aac.admin.departure-ops', () => []);

  readonly demoBookingCount = computed(() => this.bookings.all().filter((b) => b.demo).length);

  opsFor(departureId: string): DepartureOps {
    return (
      this.ops.all().find((o) => o.departureId === departureId) ?? {
        id: `ops-${departureId}`,
        departureId,
        arrangements: '',
        internalNotes: '',
        estimatedCosts: [],
        report: null,
        updatedAt: now(),
      }
    );
  }

  // The demo data ships with seat counts; on first use, create matching demo bookings so the
  // admin's numbers line up with the website. They are labelled demo and easy to delete.
  seedDemoBookings(tours: TourPackage[], departures: Departure[], settings: CompanySettings): void {
    if (!this.bookings.isNew) return;
    const list: Booking[] = [];
    let n = 0;
    for (const d of departures) {
      const tour = tours.find((t) => t.id === d.tourId);
      if (!tour) continue;
      for (const [optionId, seats] of Object.entries(d.seatsTaken)) {
        for (let left = seats; left > 0;) {
          const size = left >= 2 ? 2 : 1;
          left -= size;
          list.push(demoBooking(++n, tour, d, optionId, size, settings));
        }
      }
    }
    this.bookings.setAll(list);
  }
}

function demoBooking(
  n: number,
  tour: TourPackage,
  departure: Departure,
  optionId: string,
  travellers: number,
  settings: CompanySettings,
): Booking {
  const q = quote({
    tour,
    departure,
    optionId,
    travellers,
    addOns: {},
    gstPercent: settings.gstPercent,
    advancePercent: settings.advancePercent,
    balanceDueDays: settings.balanceDueDays,
  });
  const past = departure.status === 'completed';
  // booked 3 to 12 weeks before departure, never in the future
  const today = toIsoDate(new Date());
  const bookedOn = [addDays(departure.startDate, -(21 + ((n * 13) % 63))), today].sort()[0];
  const fullyPaid = past || n % 3 === 0;
  const at = `${bookedOn}T10:00:00.000Z`;

  return {
    id: `bkg-demo-${n}`,
    ref: `AAC-DEMO${String(n).padStart(2, '0')}`,
    createdAt: at,
    updatedAt: at,
    source: n % 4 === 0 ? 'Phone call' : 'Website',
    tourId: tour.id,
    departureId: departure.id,
    optionId,
    travellers,
    addOns: {},
    lead: {
      name: `Demo traveller ${n}`,
      phone: `90000${String(10000 + n).slice(-5)}`,
      email: '',
      city: '',
    },
    passengers: Array.from({ length: travellers }, (_, i) => ({
      name: `Demo traveller ${n}${i ? String.fromCharCode(65 + i) : ''}`,
      age: 25 + ((n + i * 7) % 20),
      gender: (i + n) % 2 ? 'Female' : 'Male',
      phone: '',
      emergencyName: '',
      emergencyPhone: '',
      notes: '',
      idChecked: past,
    })),
    notes: '',
    priceLines: q.lines,
    discount: 0,
    discountNote: '',
    gst: q.gst,
    total: q.total,
    status: past ? 'Completed' : 'Confirmed',
    holdUntil: null,
    payments: [
      {
        id: `pay-${n}-1`,
        date: bookedOn,
        kind: 'payment',
        amount: q.advance,
        method: 'UPI',
        reference: '',
        note: 'Advance',
      },
      ...(fullyPaid
        ? [
            {
              id: `pay-${n}-2`,
              date: [q.balanceDueOn, today].sort()[0],
              kind: 'payment' as const,
              amount: q.balance,
              method: 'Bank transfer' as const,
              reference: '',
              note: 'Balance',
            },
          ]
        : []),
    ],
    cancelReason: '',
    history: [{ at, text: 'Demo booking' }],
    demo: true,
  };
}
