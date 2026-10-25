import { Departure, PolicyRule, TourPackage, TravelOption } from '../models';
import { addDays, daysBetween, todayIso } from './dates';
import { roundMoney } from './price';

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

// Seats still free on a departure, overall or for one travel option. An option can't use
// more than its own allocation or what is left of the group.
export function seatsLeft(departure: Departure, optionId?: string): number {
  const groupLeft = departure.totalSeats - sum(Object.values(departure.seatsTaken));
  if (!optionId) return Math.max(0, groupLeft);
  const optionLeft = (departure.optionSeats[optionId] ?? 0) - (departure.seatsTaken[optionId] ?? 0);
  return Math.max(0, Math.min(groupLeft, optionLeft));
}

export type DepartureState = 'open' | 'filling' | 'soldout' | 'closed' | 'cancelled' | 'completed';

export function departureState(departure: Departure, today = todayIso()): DepartureState {
  if (departure.status === 'cancelled') return 'cancelled';
  if (departure.status === 'completed' || departure.endDate < today) return 'completed';
  if (departure.bookingClosesOn && departure.bookingClosesOn < today) return 'closed';
  const left = seatsLeft(departure);
  if (left === 0) return 'soldout';
  return left <= Math.max(4, Math.ceil(departure.totalSeats * 0.25)) ? 'filling' : 'open';
}

export const STATE_LABELS: Record<DepartureState, string> = {
  open: 'Seats available',
  filling: 'Filling fast',
  soldout: 'Sold out · join waitlist',
  closed: 'Booking closed',
  cancelled: 'Cancelled',
  completed: 'Completed',
};

export const isBookable = (state: DepartureState) => state === 'open' || state === 'filling';

export function optionPrice(departure: Departure | null, option: TravelOption): number {
  return departure?.priceOverrides[option.id] ?? option.price;
}

// Lowest per-person price across the tour's options, for "from ₹..." labels.
export function startingPrice(tour: TourPackage, departure: Departure | null = null): number {
  const prices = tour.travelOptions
    .filter((o) => !departure || o.id in departure.optionSeats)
    .map((o) => optionPrice(departure, o));
  return prices.length ? Math.min(...prices) : 0;
}

export function refundPercent(policy: PolicyRule[], daysBeforeDeparture: number): number {
  const rule = [...policy]
    .sort((a, b) => b.daysBefore - a.daysBefore)
    .find((r) => daysBeforeDeparture >= r.daysBefore);
  return rule?.refundPercent ?? 0;
}

export interface QuoteInput {
  tour: TourPackage;
  departure: Departure;
  optionId: string;
  travellers: number;
  // add-on id -> quantity (people for per-person add-ons, 1 for per-booking ones)
  addOns: Record<string, number>;
  discount?: number;
  gstPercent: number;
  advancePercent: number;
  balanceDueDays: number;
}

export interface QuoteLine {
  label: string;
  amount: number;
}

export interface Quote {
  lines: QuoteLine[];
  subtotal: number;
  discount: number;
  gst: number;
  total: number;
  advance: number;
  balance: number;
  balanceDueOn: string;
}

export function quote(input: QuoteInput): Quote {
  const { tour, departure, travellers } = input;
  const option = tour.travelOptions.find((o) => o.id === input.optionId);
  if (!option) throw new Error(`Unknown travel option ${input.optionId}`);

  const price = optionPrice(departure, option);
  const lines: QuoteLine[] = [
    { label: `${option.label} × ${travellers}`, amount: roundMoney(price * travellers) },
  ];
  for (const addOn of tour.addOns) {
    const qty = Math.min(input.addOns[addOn.id] ?? 0, addOn.unit === 'person' ? travellers : 1);
    if (qty > 0) {
      const label = addOn.unit === 'person' ? `${addOn.label} × ${qty}` : addOn.label;
      lines.push({ label, amount: roundMoney(addOn.price * qty) });
    }
  }

  const subtotal = roundMoney(sum(lines.map((l) => l.amount)));
  const discount = Math.min(Math.max(0, input.discount ?? 0), subtotal);
  const gst = roundMoney(((subtotal - discount) * input.gstPercent) / 100);
  const total = roundMoney(subtotal - discount + gst);
  // the advance is rounded up to the rupee so the balance never ends in paise
  const advance = Math.min(total, Math.ceil((total * input.advancePercent) / 100));

  // a late booking pays the balance straight away
  const dueOn = addDays(departure.startDate, -input.balanceDueDays);
  const balanceDueOn = dueOn < todayIso() ? todayIso() : dueOn;

  return {
    lines,
    subtotal,
    discount,
    gst,
    total,
    advance,
    balance: roundMoney(total - advance),
    balanceDueOn,
  };
}

// Refund estimate for cancelling today, based on the money already paid.
export function cancellationEstimate(
  policy: PolicyRule[],
  startDate: string,
  paid: number,
  today = todayIso(),
) {
  const daysBefore = daysBetween(today, startDate);
  const percent = refundPercent(policy, daysBefore);
  return { daysBefore, percent, refund: roundMoney((paid * percent) / 100) };
}

// AAC-7K2P9Q. No 0/O or 1/I, so it reads well over the phone.
export function newBookingRef(): string {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const random = crypto.getRandomValues(new Uint32Array(6));
  return 'AAC-' + Array.from(random, (n) => alphabet[n % alphabet.length]).join('');
}

// LDK8-270612: tour code plus the start date
export const departureCode = (tourCode: string, startDate: string): string =>
  `${tourCode}-${startDate.slice(2).replaceAll('-', '')}`;
