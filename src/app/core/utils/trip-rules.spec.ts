import { Departure, TourPackage } from '../models';
import { formatRange } from './dates';
import { formatInr } from './price';
import {
  cancellationEstimate,
  departureCode,
  departureState,
  newBookingRef,
  quote,
  refundPercent,
  seatsLeft,
  startingPrice,
} from './trip-rules';

const tour = {
  code: 'LDK8',
  travelOptions: [
    { id: 'bike-solo', price: 32000, label: 'Bike, solo rider' },
    { id: 'own-car', price: 21000, label: 'Own car' },
  ],
  addOns: [
    { id: 'single', label: 'Single room', price: 9000, unit: 'person' },
    { id: 'pickup', label: 'Airport pickup', price: 1500, unit: 'booking' },
  ],
  cancellationPolicy: [
    { daysBefore: 30, refundPercent: 90 },
    { daysBefore: 15, refundPercent: 50 },
    { daysBefore: 0, refundPercent: 0 },
  ],
} as unknown as TourPackage;

const departure: Departure = {
  id: 'd1',
  code: 'LDK8-270612',
  tourId: 't1',
  startDate: '2027-06-12',
  endDate: '2027-06-19',
  totalSeats: 20,
  optionSeats: { 'bike-solo': 12, 'own-car': 10 },
  priceOverrides: { 'own-car': 19500 },
  seatsTaken: { 'bike-solo': 10, 'own-car': 4 },
  coordinatorId: null,
  bookingClosesOn: '2027-06-05',
  status: 'scheduled',
};

describe('seats', () => {
  it('limits an option by its own seats and by the group', () => {
    expect(seatsLeft(departure)).toBe(6);
    expect(seatsLeft(departure, 'bike-solo')).toBe(2);
    expect(seatsLeft(departure, 'own-car')).toBe(6);
    expect(seatsLeft({ ...departure, totalSeats: 15 }, 'own-car')).toBe(1);
  });

  it('works out the departure state', () => {
    expect(departureState(departure, '2027-05-01')).toBe('open');
    expect(departureState({ ...departure, totalSeats: 18 }, '2027-05-01')).toBe('filling');
    expect(departureState({ ...departure, totalSeats: 14 }, '2027-05-01')).toBe('soldout');
    expect(departureState(departure, '2027-06-08')).toBe('closed');
    expect(departureState(departure, '2027-07-01')).toBe('completed');
    expect(departureState({ ...departure, status: 'cancelled' }, '2027-05-01')).toBe('cancelled');
  });

  it('uses departure prices for the starting price', () => {
    expect(startingPrice(tour)).toBe(21000);
    expect(startingPrice(tour, departure)).toBe(19500);
  });
});

describe('quote', () => {
  it('adds options, add-ons, discount and GST', () => {
    const q = quote({
      tour,
      departure,
      optionId: 'bike-solo',
      travellers: 2,
      addOns: { single: 5, pickup: 1 },
      discount: 1500,
      gstPercent: 5,
      advancePercent: 30,
      balanceDueDays: 20,
    });
    expect(q.lines.map((l) => l.amount)).toEqual([64000, 18000, 1500]);
    expect(q.subtotal).toBe(83500);
    expect(q.gst).toBe(4100);
    expect(q.total).toBe(86100);
    expect(q.advance).toBe(25830);
    expect(q.balance).toBe(60270);
    expect(q.balanceDueOn).toBe('2027-05-23');
  });

  it('rounds the advance up to a whole rupee', () => {
    const q = quote({
      tour,
      departure,
      optionId: 'own-car',
      travellers: 1,
      addOns: {},
      gstPercent: 5,
      advancePercent: 33,
      balanceDueDays: 20,
    });
    expect(q.total).toBe(20475);
    expect(q.advance).toBe(6757);
    expect(q.advance + q.balance).toBe(q.total);
  });
});

describe('cancellation policy', () => {
  it('picks the rule for the days left', () => {
    expect(refundPercent(tour.cancellationPolicy, 45)).toBe(90);
    expect(refundPercent(tour.cancellationPolicy, 30)).toBe(90);
    expect(refundPercent(tour.cancellationPolicy, 20)).toBe(50);
    expect(refundPercent(tour.cancellationPolicy, 3)).toBe(0);
  });

  it('estimates the refund on the amount paid', () => {
    expect(
      cancellationEstimate(tour.cancellationPolicy, '2027-06-12', 30000, '2027-05-20'),
    ).toEqual({ daysBefore: 23, percent: 50, refund: 15000 });
  });
});

describe('codes and formatting', () => {
  it('makes readable references', () => {
    expect(newBookingRef()).toMatch(/^AAC-[2-9A-HJ-NP-Z]{6}$/);
    expect(departureCode('LDK8', '2027-06-12')).toBe('LDK8-270612');
  });

  it('formats money and date ranges', () => {
    expect(formatInr(123456)).toBe('₹1,23,456');
    expect(formatRange('2027-06-12', '2027-06-19')).toBe('12 Jun – 19 Jun 2027');
    expect(formatRange('2027-12-28', '2028-01-04')).toBe('28 Dec 2027 – 4 Jan 2028');
  });
});
