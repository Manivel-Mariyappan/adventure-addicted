import { BookingStatusEntry, Departure } from '../../app/core/models';
import { roundMoney } from '../../app/core/utils/price';
import { Booking } from './admin-models';

// Seats are held by confirmed bookings, and by unpaid requests until their hold runs out.
// Waitlisted and cancelled bookings never hold seats.
export function holdsSeats(booking: Booking, now = new Date().toISOString()): boolean {
  switch (booking.status) {
    case 'Confirmed':
    case 'Completed':
      return true;
    case 'Requested':
    case 'Pending payment':
      return !!booking.holdUntil && booking.holdUntil > now;
    default:
      return false;
  }
}

export function seatsTaken(
  bookings: Booking[],
  departureId: string,
  now = new Date().toISOString(),
): Record<string, number> {
  const taken: Record<string, number> = {};
  for (const b of bookings) {
    if (b.departureId !== departureId || !holdsSeats(b, now)) continue;
    taken[b.optionId] = (taken[b.optionId] ?? 0) + b.travellers;
  }
  return taken;
}

// The departure as it should be published: seat counts from the bookings.
export const withLiveSeats = (departure: Departure, bookings: Booking[]): Departure => ({
  ...departure,
  seatsTaken: seatsTaken(bookings, departure.id),
});

export function paidOf(booking: Booking): number {
  return roundMoney(
    booking.payments.reduce((sum, p) => sum + (p.kind === 'refund' ? -p.amount : p.amount), 0),
  );
}

export function refundedOf(booking: Booking): number {
  return roundMoney(
    booking.payments.filter((p) => p.kind === 'refund').reduce((sum, p) => sum + p.amount, 0),
  );
}

// still to collect; nothing is owed on cancelled or waitlisted bookings
export function dueOf(booking: Booking): number {
  if (['Cancelled', 'Waitlisted', 'Refund pending'].includes(booking.status)) return 0;
  return roundMoney(Math.max(0, booking.total - paidOf(booking)));
}

export interface MoneySummary {
  // value of bookings that are going ahead (not cancelled or waitlisted)
  gross: number;
  // money received minus refunds paid
  collected: number;
  outstanding: number;
  refundsPaid: number;
  // money held on bookings waiting for a refund
  refundsPending: number;
}

export function moneySummary(bookings: Booking[]): MoneySummary {
  const live = bookings.filter(
    (b) => !['Cancelled', 'Waitlisted', 'Refund pending'].includes(b.status),
  );
  return {
    gross: roundMoney(live.reduce((s, b) => s + b.total, 0)),
    collected: roundMoney(bookings.reduce((s, b) => s + paidOf(b), 0)),
    outstanding: roundMoney(bookings.reduce((s, b) => s + dueOf(b), 0)),
    refundsPaid: roundMoney(bookings.reduce((s, b) => s + refundedOf(b), 0)),
    refundsPending: roundMoney(
      bookings.filter((b) => b.status === 'Refund pending').reduce((s, b) => s + paidOf(b), 0),
    ),
  };
}

// booking-status.json: reference, status and amounts only
export function statusEntries(bookings: Booking[]): BookingStatusEntry[] {
  return bookings
    .filter((b) => !b.demo)
    .map((b) => ({
      ref: b.ref,
      status: b.status,
      total: b.total,
      paid: paidOf(b),
      updatedAt: b.updatedAt,
    }));
}
