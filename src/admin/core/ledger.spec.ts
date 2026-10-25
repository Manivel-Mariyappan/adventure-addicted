import { Booking } from './admin-models';
import { dueOf, holdsSeats, moneySummary, paidOf, seatsTaken, statusEntries } from './ledger';

const NOW = '2027-05-01T10:00:00.000Z';

function booking(patch: Partial<Booking>): Booking {
  return {
    id: 'b',
    ref: 'AAC-AAAAAA',
    createdAt: NOW,
    updatedAt: NOW,
    source: 'Website',
    tourId: 't1',
    departureId: 'd1',
    optionId: 'bike-solo',
    travellers: 2,
    addOns: {},
    lead: { name: 'A', phone: '9000000000', email: '', city: '' },
    passengers: [],
    notes: '',
    priceLines: [],
    discount: 0,
    discountNote: '',
    gst: 0,
    total: 60000,
    status: 'Confirmed',
    holdUntil: null,
    payments: [],
    cancelReason: '',
    history: [],
    demo: false,
    ...patch,
  };
}

const pay = (amount: number, kind: 'payment' | 'refund' = 'payment') => ({
  id: String(amount),
  date: '2027-04-01',
  kind,
  amount,
  method: 'UPI' as const,
  reference: '',
  note: '',
});

describe('seat holds', () => {
  it('counts confirmed bookings and live holds only', () => {
    expect(holdsSeats(booking({ status: 'Confirmed' }), NOW)).toBe(true);
    expect(
      holdsSeats(booking({ status: 'Requested', holdUntil: '2027-05-02T00:00:00.000Z' }), NOW),
    ).toBe(true);
    expect(
      holdsSeats(booking({ status: 'Requested', holdUntil: '2027-04-30T00:00:00.000Z' }), NOW),
    ).toBe(false);
    expect(holdsSeats(booking({ status: 'Waitlisted' }), NOW)).toBe(false);
    expect(holdsSeats(booking({ status: 'Cancelled' }), NOW)).toBe(false);
  });

  it('adds up seats per travel option for one departure', () => {
    const list = [
      booking({ travellers: 2 }),
      booking({ travellers: 3, optionId: 'own-car' }),
      booking({ travellers: 1 }),
      booking({ travellers: 4, status: 'Cancelled' }),
      booking({ travellers: 5, departureId: 'd2' }),
    ];
    expect(seatsTaken(list, 'd1', NOW)).toEqual({ 'bike-solo': 3, 'own-car': 3 });
  });
});

describe('money', () => {
  it('nets refunds against payments', () => {
    const b = booking({ payments: [pay(20000), pay(40000), pay(5000, 'refund')] });
    expect(paidOf(b)).toBe(55000);
    expect(dueOf(b)).toBe(5000);
  });

  it('keeps gross, collected and outstanding apart', () => {
    const list = [
      booking({ total: 60000, payments: [pay(18000)] }),
      booking({ total: 40000, payments: [pay(40000)] }),
      booking({ total: 30000, status: 'Cancelled', payments: [pay(9000), pay(4500, 'refund')] }),
      booking({ total: 50000, status: 'Refund pending', payments: [pay(15000)] }),
      booking({ total: 20000, status: 'Waitlisted' }),
    ];
    expect(moneySummary(list)).toEqual({
      gross: 100000,
      collected: 77500,
      outstanding: 42000,
      refundsPaid: 4500,
      refundsPending: 15000,
    });
  });

  it('publishes no personal details and skips demo bookings', () => {
    const entries = statusEntries([
      booking({ payments: [pay(18000)] }),
      booking({ ref: 'AAC-DEMO00', demo: true }),
    ]);
    expect(entries).toEqual([
      { ref: 'AAC-AAAAAA', status: 'Confirmed', total: 60000, paid: 18000, updatedAt: NOW },
    ]);
  });
});
