import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ContentStore } from '../../../app/core/services/content-store';
import { daysBetween, formatDate, formatRange, todayIso } from '../../../app/core/utils/dates';
import { downloadJson } from '../../../app/core/utils/download';
import { formatInr, roundMoney } from '../../../app/core/utils/price';
import { seatsLeft } from '../../../app/core/utils/trip-rules';
import { AdminDataService } from '../../core/admin-data.service';
import {
  Booking,
  CostCategory,
  CostLine,
  DepartureOps,
  TripPack,
  TripReport,
} from '../../core/admin-models';
import { AdminAlerts } from '../../core/alerts.service';
import { downloadCsv } from '../../core/csv';
import { dueOf, holdsSeats, paidOf, withLiveSeats } from '../../core/ledger';
import { newId } from '../../core/local-collection';
import { AdminCard } from '../../shared/admin-card';

const COST_CATEGORIES: CostCategory[] = [
  'Hotels',
  'Transport',
  'Bikes',
  'Fuel',
  'Permits',
  'Meals',
  'Guide and staff',
  'Other',
];

@Component({
  selector: 'app-departure-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, AdminCard],
  templateUrl: './departure-detail.html',
})
export class DepartureDetail {
  private readonly store = inject(ContentStore);
  private readonly data = inject(AdminDataService);
  private readonly alerts = inject(AdminAlerts);
  private readonly router = inject(Router);
  readonly formatInr = formatInr;
  readonly formatDate = formatDate;
  readonly categories = COST_CATEGORIES;

  readonly id = input.required<string>();

  readonly departure = computed(() => this.store.departures().find((d) => d.id === this.id()));
  readonly tour = computed(() => this.store.tours().find((t) => t.id === this.departure()?.tourId));
  readonly coordinators = computed(() => this.store.coordinators().filter((c) => c.active));
  readonly coordinator = computed(() =>
    this.store.coordinators().find((c) => c.id === this.departure()?.coordinatorId),
  );
  readonly dates = computed(() => {
    const d = this.departure();
    return d ? formatRange(d.startDate, d.endDate) : '';
  });
  readonly daysToGo = computed(() => {
    const d = this.departure();
    return d ? daysBetween(todayIso(), d.startDate) : 0;
  });

  readonly bookings = computed(() =>
    this.data.bookings.all().filter((b) => b.departureId === this.id()),
  );
  readonly seated = computed(() => this.bookings().filter((b) => holdsSeats(b)));
  readonly waitlist = computed(() => this.bookings().filter((b) => b.status === 'Waitlisted'));
  readonly expiredHolds = computed(() =>
    this.bookings().filter(
      (b) => ['Requested', 'Pending payment'].includes(b.status) && !holdsSeats(b),
    ),
  );

  readonly capacity = computed(() => {
    const d = this.departure();
    const t = this.tour();
    if (!d || !t) return null;
    const live = withLiveSeats(d, this.data.bookings.all());
    const taken = Object.values(live.seatsTaken).reduce((a, b) => a + b, 0);
    return {
      taken,
      left: seatsLeft(live),
      total: d.totalSeats,
      minimum: t.minParticipants,
      options: t.travelOptions
        .filter((o) => o.id in d.optionSeats)
        .map((o) => ({
          label: o.label,
          seats: d.optionSeats[o.id],
          taken: live.seatsTaken[o.id] ?? 0,
          left: seatsLeft(live, o.id),
        })),
    };
  });

  readonly manifest = computed(() => {
    const options = new Map(this.tour()?.travelOptions.map((o) => [o.id, o.label]));
    return this.seated().flatMap((b) =>
      b.passengers.map((p, i) => ({
        key: `${b.ref}-${i + 1}`,
        ref: b.ref,
        status: b.status,
        option: options.get(b.optionId) ?? b.optionId,
        lead: b.lead,
        ...p,
        name: p.name || (i === 0 ? b.lead.name : `Traveller ${i + 1}`),
      })),
    );
  });

  readonly money = computed(() => {
    const list = this.bookings().filter((b) => !['Cancelled', 'Waitlisted'].includes(b.status));
    const gross = roundMoney(list.reduce((s, b) => s + b.total, 0));
    const collected = roundMoney(this.bookings().reduce((s, b) => s + paidOf(b), 0));
    const outstanding = roundMoney(list.reduce((s, b) => s + dueOf(b), 0));
    const estimated = roundMoney(this.costs().reduce((s, c) => s + (Number(c.amount) || 0), 0));
    const actual = roundMoney(
      (this.ops().report?.expenses ?? []).reduce((s, e) => s + e.amount, 0),
    );
    return {
      gross,
      collected,
      outstanding,
      estimated,
      actual,
      estimatedProfit: roundMoney(gross - estimated),
      actualProfit: roundMoney(collected - estimated - actual),
    };
  });

  // operations record, edited locally and saved with the Save button
  readonly ops = signal<DepartureOps>(this.data.opsFor(''));
  readonly arrangements = signal('');
  readonly internalNotes = signal('');
  readonly costs = signal<CostLine[]>([]);

  readonly report = computed(() => this.ops().report);
  readonly reportSummary = computed(() => {
    const r = this.report();
    if (!r) return null;
    const people = this.manifest().length;
    const days = Object.keys(r.attendance).length;
    return {
      days,
      avgAttendance: days
        ? Math.round(Object.values(r.attendance).reduce((s, list) => s + list.length, 0) / days)
        : 0,
      people,
      expenses: roundMoney(r.expenses.reduce((s, e) => s + e.amount, 0)),
    };
  });

  constructor() {
    effect(() => {
      const ops = this.data.opsFor(this.id());
      this.ops.set(ops);
      this.arrangements.set(ops.arrangements);
      this.internalNotes.set(ops.internalNotes);
      this.costs.set(structuredClone(ops.estimatedCosts));
    });
  }

  addCost(): void {
    this.costs.update((list) => [
      ...list,
      { id: newId('cost'), label: '', category: 'Hotels', amount: 0 },
    ]);
  }

  updateCost(id: string, patch: Partial<CostLine>): void {
    this.costs.update((list) => list.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  removeCost(id: string): void {
    this.costs.update((list) => list.filter((c) => c.id !== id));
  }

  saveOps(): void {
    const record: DepartureOps = {
      ...this.ops(),
      arrangements: this.arrangements().trim(),
      internalNotes: this.internalNotes().trim(),
      estimatedCosts: this.costs()
        .filter((c) => c.label.trim() || c.amount)
        .map((c) => ({ ...c, label: c.label.trim(), amount: Number(c.amount) || 0 })),
      updatedAt: new Date().toISOString(),
    };
    this.data.ops.upsert(record);
    this.ops.set(record);
    void this.alerts.toast('Operations saved');
  }

  assignCoordinator(coordinatorId: string | null): void {
    const d = this.departure();
    if (!d) return;
    this.store.saveDraft(
      'departures',
      this.store.departures().map((x) => (x.id === d.id ? { ...x, coordinatorId } : x)),
    );
    void this.alerts.toast(coordinatorId ? 'Coordinator assigned' : 'Coordinator removed');
  }

  downloadTripPack(): void {
    const d = this.departure();
    const t = this.tour();
    if (!d || !t) return;
    const pack: TripPack = {
      kind: 'aac-trip-pack',
      version: 1,
      generatedAt: new Date().toISOString(),
      departureId: d.id,
      departureCode: d.code,
      tourName: t.name,
      startDate: d.startDate,
      endDate: d.endDate,
      arrangements: this.arrangements(),
      passengers: this.manifest().map((m) => ({
        key: m.key,
        bookingRef: m.ref,
        option: m.option,
        leadPhone: m.lead.phone,
        name: m.name,
        age: m.age,
        gender: m.gender,
        phone: m.phone,
        emergencyName: m.emergencyName,
        emergencyPhone: m.emergencyPhone,
        notes: m.notes,
        idChecked: m.idChecked,
      })),
    };
    downloadJson(`trip-pack-${d.code}.json`, pack);
    void this.alerts.toast('Trip pack downloaded. Send it to the coordinator privately.');
  }

  async importReport(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      const report = JSON.parse(await file.text()) as TripReport;
      if (report.kind !== 'aac-trip-report') throw new Error('not a report');
      if (report.departureId !== this.id()) {
        void this.alerts.error('Wrong departure', 'This report is for a different departure.');
        return;
      }
      const record = { ...this.ops(), report, updatedAt: new Date().toISOString() };
      this.data.ops.upsert(record);
      this.ops.set(record);
      void this.alerts.success(
        'Report imported',
        `${report.expenses.length} expenses, ${report.incidents.length} incidents`,
      );
    } catch {
      void this.alerts.error(
        'Could not read this file',
        'Choose the report file exported from the coordinator portal.',
      );
    }
  }

  exportManifest(): void {
    const d = this.departure();
    if (!d) return;
    downloadCsv(
      `manifest-${d.code}.csv`,
      this.manifest().map((m) => ({
        Booking: m.ref,
        Name: m.name,
        Age: m.age ?? '',
        Gender: m.gender,
        Option: m.option,
        Phone: m.phone || m.lead.phone,
        'Emergency contact': [m.emergencyName, m.emergencyPhone].filter(Boolean).join(' '),
        Notes: m.notes,
        'ID checked': m.idChecked ? 'Yes' : 'No',
      })),
    );
  }

  async setStatus(status: 'completed' | 'cancelled'): Promise<void> {
    const d = this.departure();
    if (!d) return;
    const seated = this.seated().length;
    const ok =
      status === 'completed'
        ? await this.alerts.confirm(
            'Mark this departure completed?',
            'Its confirmed bookings are marked Completed too.',
            'Yes',
          )
        : await this.alerts.confirmDelete(
            'Cancel this departure?',
            `${seated} booking(s) move to Refund pending. It disappears from the website after you publish.`,
          );
    if (!ok) return;
    this.store.saveDraft(
      'departures',
      this.store.departures().map((x) => (x.id === d.id ? { ...x, status } : x)),
    );
    const now = new Date().toISOString();
    for (const b of this.bookings()) {
      let next: Booking['status'] | null = null;
      if (status === 'completed' && b.status === 'Confirmed') next = 'Completed';
      if (status === 'cancelled' && !['Cancelled', 'Completed'].includes(b.status)) {
        next = paidOf(b) > 0 ? 'Refund pending' : 'Cancelled';
      }
      if (next) {
        this.data.bookings.upsert({
          ...b,
          status: next,
          holdUntil: null,
          updatedAt: now,
          history: [
            ...b.history,
            { at: now, text: `Departure ${status}: booking ${next.toLowerCase()}` },
          ],
        });
      }
    }
    void this.alerts.success(
      status === 'completed' ? 'Departure completed' : 'Departure cancelled',
      d.code,
    );
  }

  openBookings(): void {
    void this.router.navigate(['/admin/bookings'], { queryParams: { departure: this.id() } });
  }
}
