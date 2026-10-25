import { TourPackage } from '../models';
import { BookingRequest, bookingMessage, parseBookingMessage } from './booking-message';

const tour = {
  code: 'LDK8',
  name: 'Leh Ladakh Bike Expedition',
  travelOptions: [{ id: 'bike-solo', label: 'Royal Enfield Himalayan 450, solo rider' }],
  addOns: [
    { id: 'single', label: 'Single room', unit: 'person' },
    { id: 'pickup', label: 'Airport pickup', unit: 'booking' },
  ],
} as unknown as TourPackage;

const request: BookingRequest = {
  ref: 'AAC-7K2P9Q',
  waitlist: false,
  tourCode: 'LDK8',
  departureCode: 'LDK8-270612',
  startDate: '2027-06-12',
  endDate: '2027-06-19',
  optionId: 'bike-solo',
  travellers: 2,
  addOns: { single: 2, pickup: 1 },
  people: [
    { name: 'Ravi Kumar', age: 32, gender: 'Male' },
    { name: 'Priya Kumar', age: null, gender: '' },
  ],
  lead: { name: 'Ravi Kumar', phone: '9876543210', email: 'ravi@example.com', city: 'Chennai' },
  notes: 'Vegetarian meals',
  total: 86100,
  advance: 25830,
};

describe('booking message', () => {
  it('builds a readable WhatsApp message', () => {
    expect(bookingMessage(request, tour)).toBe(
      [
        '*Booking request* AAC-7K2P9Q',
        'Tour: Leh Ladakh Bike Expedition (LDK8)',
        'Departure: 12 Jun – 19 Jun 2027 (LDK8-270612)',
        'Travel: Royal Enfield Himalayan 450, solo rider [bike-solo] × 2',
        'Add-ons: Single room × 2; Airport pickup',
        'Travellers:',
        '1. Ravi Kumar, 32, Male',
        '2. Priya Kumar',
        'Lead: Ravi Kumar, 9876543210, ravi@example.com, Chennai',
        'Notes: Vegetarian meals',
        'Total: ₹86,100 (advance ₹25,830)',
        'Please confirm the seats and share the payment details.',
      ].join('\n'),
    );
  });

  it('reads its own message back', () => {
    const parsed = parseBookingMessage(bookingMessage(request, tour))!;
    expect(parsed).toEqual({
      ref: 'AAC-7K2P9Q',
      waitlist: false,
      departureCode: 'LDK8-270612',
      optionId: 'bike-solo',
      travellers: 2,
      addOnLabels: { 'Single room': 2, 'Airport pickup': 1 },
      people: request.people,
      lead: request.lead,
      notes: 'Vegetarian meals',
    });
  });

  it('marks waitlist requests and ignores other messages', () => {
    const waitlist = bookingMessage({ ...request, waitlist: true }, tour);
    expect(parseBookingMessage(waitlist)!.waitlist).toBe(true);
    expect(parseBookingMessage('Hi, is the June Ladakh trip still on?')).toBeNull();
  });
});
