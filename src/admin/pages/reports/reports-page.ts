import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ContentStore } from '../../../app/core/services/content-store';
import { formatRange, todayIso } from '../../../app/core/utils/dates';
import { formatInr, roundMoney } from '../../../app/core/utils/price';
import { AdminDataService } from '../../core/admin-data.service';
import { downloadCsv } from '../../core/csv';
import { dueOf, holdsSeats, paidOf, refundedOf } from '../../core/ledger';

type Tab = 'departures' | 'tours' | 'coordinators' | 'cancellations' | 'costs';

const sum = (values: number[]) => roundMoney(values.reduce((a, b) => a + b, 0));

@Component({
  selector: 'app-reports-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reports-page.html',
})
export class ReportsPage {
  private readonly store = inject(ContentStore);
  private readonly data = inject(AdminDataService);
  readonly formatInr = formatInr;

  readonly tab = signal<Tab>('departures');
  readonly tabs: { key: Tab; label: string }[] = [
    { key: 'departures', label: 'By departure' },
    { key: 'tours', label: 'By tour' },
    { key: 'coordinators', label: 'Coordinators' },
    { key: 'cancellations', label: 'Cancellations and refunds' },
    { key: 'costs', label: 'Costs' },
  ];

  private readonly live = computed(() =>
    this.data.bookings.all().filter((b) => !['Cancelled', 'Waitlisted'].includes(b.status)),
  );

  readonly byDeparture = computed(() => {
    const tours = new Map(this.store.tours().map((t) => [t.id, t.name]));
    return [...this.store.departures()]
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
      .map((d) => {
        const bookings = this.data.bookings.all().filter((b) => b.departureId === d.id);
        const live = bookings.filter((b) => !['Cancelled', 'Waitlisted'].includes(b.status));
        const ops = this.data.opsFor(d.id);
        const estimated = sum(ops.estimatedCosts.map((c) => c.amount));
        const actual = sum((ops.report?.expenses ?? []).map((e) => e.amount));
        const gross = sum(live.map((b) => b.total));
        return {
          code: d.code,
          tour: tours.get(d.tourId) ?? '',
          dates: formatRange(d.startDate, d.endDate),
          status: d.status,
          seats: `${bookings.filter((b) => holdsSeats(b)).reduce((s, b) => s + b.travellers, 0)}/${d.totalSeats}`,
          bookings: live.length,
          gross,
          collected: sum(bookings.map(paidOf)),
          outstanding: sum(live.map(dueOf)),
          estimated,
          actual,
          profit: roundMoney(gross - estimated - actual),
        };
      });
  });

  readonly byTour = computed(() =>
    this.store.tours().map((t) => {
      const bookings = this.live().filter((b) => b.tourId === t.id);
      return {
        code: t.code,
        tour: t.name,
        status: t.status,
        departures: this.store.departures().filter((d) => d.tourId === t.id).length,
        bookings: bookings.length,
        travellers: bookings.reduce((s, b) => s + b.travellers, 0),
        gross: sum(bookings.map((b) => b.total)),
        collected: sum(bookings.map(paidOf)),
      };
    }),
  );

  readonly byCoordinator = computed(() => {
    const today = todayIso();
    return this.store.coordinators().map((c) => {
      const mine = this.store.departures().filter((d) => d.coordinatorId === c.id);
      const ids = new Set(mine.map((d) => d.id));
      return {
        name: c.name,
        upcoming: mine.filter((d) => d.status === 'scheduled' && d.endDate >= today).length,
        completed: mine.filter((d) => d.status === 'completed' || d.endDate < today).length,
        travellers: this.live()
          .filter((b) => ids.has(b.departureId))
          .reduce((s, b) => s + b.travellers, 0),
        reports: mine.filter((d) => this.data.opsFor(d.id).report).length,
      };
    });
  });

  readonly cancellations = computed(() => {
    const departures = new Map(this.store.departures().map((d) => [d.id, d.code]));
    return this.data.bookings
      .all()
      .filter((b) => b.status === 'Cancelled' || b.status === 'Refund pending' || refundedOf(b) > 0)
      .map((b) => ({
        ref: b.ref,
        lead: b.lead.name,
        departure: departures.get(b.departureId) ?? '',
        status: b.status,
        total: b.total,
        received: sum(b.payments.filter((p) => p.kind === 'payment').map((p) => p.amount)),
        refunded: refundedOf(b),
        reason: b.cancelReason,
      }));
  });

  readonly costs = computed(() => {
    const byCategory = new Map<string, { estimated: number; actual: number }>();
    const add = (category: string, field: 'estimated' | 'actual', amount: number) => {
      const row = byCategory.get(category) ?? { estimated: 0, actual: 0 };
      row[field] = roundMoney(row[field] + amount);
      byCategory.set(category, row);
    };
    for (const ops of this.data.ops.all()) {
      ops.estimatedCosts.forEach((c) => add(c.category, 'estimated', c.amount));
      (ops.report?.expenses ?? []).forEach((e) => add(e.category, 'actual', e.amount));
    }
    return [...byCategory.entries()].map(([category, v]) => ({ category, ...v }));
  });

  readonly totals = computed(() => ({
    gross: sum(this.byDeparture().map((r) => r.gross)),
    collected: sum(this.byDeparture().map((r) => r.collected)),
    outstanding: sum(this.byDeparture().map((r) => r.outstanding)),
    profit: sum(this.byDeparture().map((r) => r.profit)),
  }));

  export(): void {
    const rows: Record<Tab, () => Record<string, string | number>[]> = {
      departures: () => this.byDeparture(),
      tours: () => this.byTour(),
      coordinators: () => this.byCoordinator(),
      cancellations: () => this.cancellations(),
      costs: () => this.costs(),
    };
    downloadCsv(`report-${this.tab()}-${todayIso()}.csv`, rows[this.tab()]());
  }
}
