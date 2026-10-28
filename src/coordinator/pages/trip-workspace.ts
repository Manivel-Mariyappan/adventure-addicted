import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ContentStore } from '../../app/core/services/content-store';
import { whatsappUrl } from '../../app/core/services/whatsapp.service';
import {
  addDays,
  daysBetween,
  formatDate,
  formatRange,
  todayIso,
} from '../../app/core/utils/dates';
import { downloadJson } from '../../app/core/utils/download';
import { formatInr, roundMoney } from '../../app/core/utils/price';
import { CostCategory, DailyReport, Incident, TripPack } from '../../admin/core/admin-models';
import { AdminAlerts } from '../../admin/core/alerts.service';
import { newId } from '../../admin/core/local-collection';
import { CoordinatorAuthService } from '../core/coordinator-auth.service';
import { TripLog, TripLogService } from '../core/trip-log.service';

type Tab = 'today' | 'itinerary' | 'passengers' | 'attendance' | 'log' | 'finish';

@Component({
  selector: 'app-trip-workspace',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink],
  templateUrl: './trip-workspace.html',
})
export class TripWorkspace {
  private readonly store = inject(ContentStore);
  private readonly logs = inject(TripLogService);
  private readonly auth = inject(CoordinatorAuthService);
  private readonly alerts = inject(AdminAlerts);
  readonly formatInr = formatInr;
  readonly formatDate = formatDate;

  readonly id = input.required<string>();

  readonly tab = signal<Tab>('today');
  readonly tabs: { key: Tab; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'itinerary', label: 'Itinerary' },
    { key: 'passengers', label: 'Passengers' },
    { key: 'attendance', label: 'Attendance' },
    { key: 'log', label: 'Log' },
    { key: 'finish', label: 'Finish' },
  ];
  readonly categories: CostCategory[] = [
    'Fuel',
    'Meals',
    'Hotels',
    'Transport',
    'Bikes',
    'Permits',
    'Guide and staff',
    'Other',
  ];

  readonly departure = computed(() =>
    this.store
      .departures()
      .find((d) => d.id === this.id() && d.coordinatorId === this.auth.coordinatorId()),
  );
  readonly tour = computed(() => this.store.tours().find((t) => t.id === this.departure()?.tourId));
  readonly dates = computed(() => {
    const d = this.departure();
    return d ? formatRange(d.startDate, d.endDate) : '';
  });

  readonly log = computed<TripLog>(() => {
    this.logs.version();
    return this.logs.get(this.id());
  });
  readonly pack = computed(() => this.log().pack);
  readonly passengers = computed(() => this.pack()?.passengers ?? []);

  // which day of the trip it is today (1-based), clamped to the trip
  readonly todayDay = computed(() => {
    const d = this.departure();
    const days = this.tour()?.days ?? 1;
    if (!d) return 1;
    return Math.min(days, Math.max(1, daysBetween(d.startDate, todayIso()) + 1));
  });
  readonly selectedDay = signal<number | null>(null);
  readonly day = computed(() => this.selectedDay() ?? this.todayDay());
  readonly dayPlan = computed(() => this.tour()?.itinerary.find((x) => x.day === this.day()));
  readonly dayDate = computed(() => {
    const d = this.departure();
    return d ? formatDate(addDays(d.startDate, this.day() - 1)) : '';
  });

  readonly present = computed(() => new Set(this.log().attendance[this.day()] ?? []));
  readonly checkedIn = computed(() => new Set(this.log().checkedIn));
  readonly attendanceDays = computed(() => Object.keys(this.log().attendance).length);
  readonly expenseTotal = computed(() =>
    roundMoney(this.log().expenses.reduce((s, e) => s + e.amount, 0)),
  );
  readonly dayReport = computed(() => this.log().dailyReports.find((r) => r.day === this.day()));

  // form fields
  announcement = '';
  incident = { title: '', details: '', severity: 'Low' as Incident['severity'] };
  expense = { category: 'Fuel' as CostCategory, description: '', amount: '', paidBy: '' };
  report = { status: 'On plan' as DailyReport['status'], summary: '' };
  finalSummary = '';

  readonly officeNumber = computed(() => this.store.settings()?.whatsappNumber ?? '');

  private save(change: (log: TripLog) => TripLog): void {
    this.logs.update(this.id(), change);
  }

  async importPack(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      const pack = JSON.parse(await file.text()) as TripPack;
      if (pack.kind !== 'aac-trip-pack') throw new Error('not a pack');
      if (pack.departureId !== this.id()) {
        void this.alerts.error(
          'Wrong trip pack',
          `This trip pack belongs to departure ${pack.departureCode}.`,
        );
        return;
      }
      this.save((log) => ({ ...log, pack }));
      void this.alerts.success('Trip pack loaded', `${pack.passengers.length} passengers`);
    } catch {
      void this.alerts.error(
        "Couldn't open this file",
        'Use the trip pack file sent by the office.',
      );
    }
  }

  toggleCheckIn(key: string): void {
    this.save((log) => ({
      ...log,
      checkedIn: log.checkedIn.includes(key)
        ? log.checkedIn.filter((k) => k !== key)
        : [...log.checkedIn, key],
    }));
  }

  togglePresent(key: string): void {
    const day = this.day();
    this.save((log) => {
      const list = log.attendance[day] ?? [];
      const next = list.includes(key) ? list.filter((k) => k !== key) : [...list, key];
      return { ...log, attendance: { ...log.attendance, [day]: next } };
    });
  }

  allPresent(): void {
    const day = this.day();
    this.save((log) => ({
      ...log,
      attendance: { ...log.attendance, [day]: this.passengers().map((p) => p.key) },
    }));
  }

  // shares to any chat, so the coordinator can pick the group
  shareLink(text: string): string {
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  }

  addAnnouncement(): void {
    const text = this.announcement.trim();
    if (!text) return;
    this.save((log) => ({
      ...log,
      announcements: [
        { id: newId('ann'), at: new Date().toISOString(), text },
        ...log.announcements,
      ],
    }));
    window.open(this.shareLink(text), '_blank', 'noopener');
    this.announcement = '';
  }

  addIncident(): void {
    const { title, details, severity } = this.incident;
    if (!title.trim()) return;
    this.save((log) => ({
      ...log,
      incidents: [
        {
          id: newId('inc'),
          at: new Date().toISOString(),
          day: this.day(),
          severity,
          title: title.trim(),
          details: details.trim(),
        },
        ...log.incidents,
      ],
    }));
    if (severity === 'High') {
      const url = whatsappUrl(
        this.officeNumber(),
        `URGENT ${this.departure()?.code} day ${this.day()}: ${title.trim()}. ${details.trim()}`,
      );
      if (url) window.open(url, '_blank', 'noopener');
    }
    this.incident = { title: '', details: '', severity: 'Low' };
    void this.alerts.toast('Incident recorded');
  }

  addExpense(): void {
    const amount = Number(this.expense.amount);
    if (!this.expense.description.trim() || !(amount > 0)) return;
    this.save((log) => ({
      ...log,
      expenses: [
        {
          id: newId('exp'),
          at: new Date().toISOString(),
          day: this.day(),
          category: this.expense.category,
          description: this.expense.description.trim(),
          amount,
          paidBy: this.expense.paidBy.trim(),
        },
        ...log.expenses,
      ],
    }));
    this.expense = { ...this.expense, description: '', amount: '' };
    void this.alerts.toast('Expense added');
  }

  removeExpense(id: string): void {
    this.save((log) => ({ ...log, expenses: log.expenses.filter((e) => e.id !== id) }));
  }

  saveDailyReport(): void {
    const summary = this.report.summary.trim();
    if (!summary) return;
    const day = this.day();
    const present = this.present().size;
    this.save((log) => ({
      ...log,
      dailyReports: [
        ...log.dailyReports.filter((r) => r.day !== day),
        { day, at: new Date().toISOString(), status: this.report.status, summary },
      ].sort((a, b) => a.day - b.day),
    }));
    const text = `${this.departure()?.code} day ${day} (${this.dayPlan()?.title ?? ''}): ${this.report.status}. ${present}/${this.passengers().length} present. ${summary}`;
    const url = whatsappUrl(this.officeNumber(), text);
    if (url) window.open(url, '_blank', 'noopener');
    this.report = { status: 'On plan', summary: '' };
  }

  async complete(): Promise<void> {
    const ok = await this.alerts.confirm(
      'Mark the trip completed?',
      'Then download the report and send it to the office.',
      'Complete',
    );
    if (!ok) return;
    this.save((log) => ({
      ...log,
      completedAt: new Date().toISOString(),
      finalSummary: this.finalSummary.trim() || log.finalSummary,
    }));
  }

  downloadReport(): void {
    const d = this.departure();
    const coordinatorId = this.auth.coordinatorId();
    if (!d || !coordinatorId) return;
    if (this.finalSummary.trim())
      this.save((log) => ({ ...log, finalSummary: this.finalSummary.trim() }));
    downloadJson(`trip-report-${d.code}.json`, this.logs.report(d.id, coordinatorId));
    void this.alerts.toast('Report downloaded. Send the file to the office.');
  }

  readonly officeSummaryLink = computed(() => {
    const log = this.log();
    const d = this.departure();
    if (!d) return null;
    const text = [
      `Trip report ${d.code}`,
      `Status: ${log.completedAt ? 'completed' : 'in progress'}`,
      `Incidents: ${log.incidents.length}`,
      `Expenses: ${formatInr(this.expenseTotal())} (${log.expenses.length} entries)`,
      log.finalSummary ? `Summary: ${log.finalSummary}` : '',
      'Report file to follow.',
    ]
      .filter(Boolean)
      .join('\n');
    return whatsappUrl(this.officeNumber(), text);
  });

  tel(phone: string): string {
    return `tel:${phone.replace(/[^\d+]/g, '')}`;
  }
}
