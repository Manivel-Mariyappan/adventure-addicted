import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ContentStore } from '../../../app/core/services/content-store';
import { addDays, daysBetween, formatRange, todayIso } from '../../../app/core/utils/dates';
import { formatInr, roundMoney } from '../../../app/core/utils/price';
import { seatsLeft } from '../../../app/core/utils/trip-rules';
import { AdminDataService } from '../../core/admin-data.service';
import { dueOf, holdsSeats, moneySummary, withLiveSeats } from '../../core/ledger';
import { BarChart, BarDatum } from '../../shared/bar-chart';

type Period = 'month' | 'quarter' | 'year' | 'all';

const PERIODS: { key: Period; label: string }[] = [
  { key: 'month', label: 'This month' },
  { key: 'quarter', label: 'Last 90 days' },
  { key: 'year', label: 'This year' },
  { key: 'all', label: 'All time' },
];

const monthLabel = new Intl.DateTimeFormat('en-IN', { month: 'short' });
const compactInr = (v: number) =>
  v >= 1_00_000
    ? `₹${(v / 1_00_000).toFixed(1)}L`
    : v >= 1000
      ? `₹${Math.round(v / 1000)}K`
      : formatInr(v);

@Component({
  selector: 'app-dashboard-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, BarChart],
  templateUrl: './dashboard-page.html',
})
export class DashboardPage {
  private readonly store = inject(ContentStore);
  private readonly data = inject(AdminDataService);
  readonly formatInr = formatInr;
  readonly periods = PERIODS;
  readonly period = signal<Period>('year');

  private readonly from = computed(() => {
    const today = todayIso();
    switch (this.period()) {
      case 'month':
        return today.slice(0, 8) + '01';
      case 'quarter':
        return addDays(today, -90);
      case 'year':
        return today.slice(0, 5) + '01-01';
      default:
        return '';
    }
  });

  // bookings made in the chosen period
  private readonly inPeriod = computed(() =>
    this.data.bookings.all().filter((b) => b.createdAt.slice(0, 10) >= this.from()),
  );

  readonly money = computed(() => moneySummary(this.inPeriod()));

  readonly upcoming = computed(() => {
    const today = todayIso();
    const tours = new Map(this.store.tours().map((t) => [t.id, t]));
    const coordinators = new Map(this.store.coordinators().map((c) => [c.id, c.name]));
    return this.store
      .departures()
      .filter((d) => d.status === 'scheduled' && d.startDate >= today)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
      .map((d) => {
        const live = withLiveSeats(d, this.data.bookings.all());
        const taken = Object.values(live.seatsTaken).reduce((a, b) => a + b, 0);
        const tour = tours.get(d.tourId);
        return {
          departure: d,
          tour: tour?.name ?? '',
          dates: formatRange(d.startDate, d.endDate),
          taken,
          left: seatsLeft(live),
          minimum: tour?.minParticipants ?? 0,
          daysToGo: daysBetween(today, d.startDate),
          coordinator: d.coordinatorId ? (coordinators.get(d.coordinatorId) ?? '') : '',
        };
      });
  });

  readonly kpis = computed(() => {
    const all = this.data.bookings.all();
    const period = this.inPeriod();
    const up = this.upcoming();
    const seatsTotal = up.reduce((s, u) => s + u.departure.totalSeats, 0);
    const seatsTaken = up.reduce((s, u) => s + u.taken, 0);
    const pending = all.filter(
      (b) => dueOf(b) > 0 && ['Requested', 'Pending payment', 'Confirmed'].includes(b.status),
    );
    return {
      packages: this.store.tours().filter((t) => t.status === 'published').length,
      packagesTotal: this.store.tours().length,
      departures: up.length,
      bookings: period.length,
      travellers: all.filter((b) => b.status === 'Confirmed').reduce((s, b) => s + b.travellers, 0),
      seatsTaken,
      seatsTotal,
      pendingCount: pending.length,
      pendingAmount: roundMoney(pending.reduce((s, b) => s + dueOf(b), 0)),
      cancelled: period.filter((b) => b.status === 'Cancelled' || b.status === 'Refund pending')
        .length,
    };
  });

  readonly conversion = computed(() => {
    const p = this.inPeriod();
    const requests = p.length;
    const confirmed = p.filter((b) => b.status === 'Confirmed' || b.status === 'Completed').length;
    return {
      requests,
      confirmed,
      waitlisted: p.filter((b) => b.status === 'Waitlisted').length,
      rate: requests ? Math.round((confirmed / requests) * 100) : 0,
    };
  });

  // last 12 months by booking date
  private readonly months = computed(() => {
    const now = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const list = this.data.bookings
        .all()
        .filter(
          (b) => b.createdAt.startsWith(key) && !['Cancelled', 'Waitlisted'].includes(b.status),
        );
      return {
        label: monthLabel.format(d),
        bookings: list.length,
        travellers: list.reduce((s, b) => s + b.travellers, 0),
        value: roundMoney(list.reduce((s, b) => s + b.total, 0)),
      };
    });
  });

  readonly bookingsChart = computed<BarDatum[]>(() =>
    this.months().map((m) => ({
      label: m.label,
      value: m.bookings,
      display: String(m.bookings),
      detail: `${m.travellers} travellers`,
    })),
  );

  readonly revenueChart = computed<BarDatum[]>(() =>
    this.months().map((m) => ({
      label: m.label,
      value: m.value,
      display: compactInr(m.value),
      detail: formatInr(m.value),
    })),
  );

  // travellers per region, for bookings in the period
  readonly destinationsChart = computed<BarDatum[]>(() => {
    const destinations = this.store.destinations();
    const regionOf = (id: string) => {
      const d = destinations.find((x) => x.id === id);
      return d?.parentId ? destinations.find((x) => x.id === d.parentId)?.name : d?.name;
    };
    const tours = new Map(this.store.tours().map((t) => [t.id, t]));
    const counts = new Map<string, number>();
    for (const b of this.inPeriod()) {
      if (['Cancelled', 'Waitlisted'].includes(b.status)) continue;
      const regions = new Set(
        (tours.get(b.tourId)?.destinationIds ?? []).map(regionOf).filter(Boolean) as string[],
      );
      for (const r of regions) counts.set(r, (counts.get(r) ?? 0) + b.travellers);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({ label, value, display: `${value} travellers` }));
  });

  readonly occupancyChart = computed<BarDatum[]>(() =>
    this.upcoming()
      .slice(0, 8)
      .map((u) => ({
        label: u.departure.code,
        value: Math.round((u.taken / u.departure.totalSeats) * 100),
        display: `${Math.round((u.taken / u.departure.totalSeats) * 100)}%`,
        detail: `${u.tour}: ${u.taken} of ${u.departure.totalSeats} seats`,
      })),
  );

  readonly alerts = computed(() => {
    const now = new Date().toISOString();
    const today = todayIso();
    const settings = this.store.settings();
    const departures = new Map(this.store.departures().map((d) => [d.id, d]));
    const all = this.data.bookings.all();
    return {
      short: this.upcoming().filter((u) => u.daysToGo <= 45 && u.taken < u.minimum),
      noCoordinator: this.upcoming().filter((u) => u.daysToGo <= 60 && !u.coordinator),
      expiredHolds: all.filter(
        (b) => ['Requested', 'Pending payment'].includes(b.status) && !holdsSeats(b, now),
      ),
      overdue: all.filter((b) => {
        const d = departures.get(b.departureId);
        if (!d || !settings || b.status !== 'Confirmed' || dueOf(b) <= 0) return false;
        return addDays(d.startDate, -settings.balanceDueDays) < today;
      }),
      refunds: all.filter((b) => b.status === 'Refund pending'),
    };
  });
}
