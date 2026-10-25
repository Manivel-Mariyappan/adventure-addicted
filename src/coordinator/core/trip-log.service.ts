import { Injectable, signal } from '@angular/core';
import {
  Announcement,
  DailyReport,
  Incident,
  TripExpense,
  TripPack,
  TripReport,
} from '../../admin/core/admin-models';

// Everything a coordinator records for one departure, kept on their phone until they export
// the report for the office.
export interface TripLog {
  pack: TripPack | null;
  attendance: Record<number, string[]>;
  checkedIn: string[];
  announcements: Announcement[];
  incidents: Incident[];
  expenses: TripExpense[];
  dailyReports: DailyReport[];
  completedAt: string | null;
  finalSummary: string;
}

const key = (departureId: string) => `aac.coordinator.trip.${departureId}`;

const empty = (): TripLog => ({
  pack: null,
  attendance: {},
  checkedIn: [],
  announcements: [],
  incidents: [],
  expenses: [],
  dailyReports: [],
  completedAt: null,
  finalSummary: '',
});

@Injectable({ providedIn: 'root' })
export class TripLogService {
  // bumped on every save so views re-read
  readonly version = signal(0);

  get(departureId: string): TripLog {
    try {
      const raw = localStorage.getItem(key(departureId));
      return raw ? { ...empty(), ...(JSON.parse(raw) as TripLog) } : empty();
    } catch {
      return empty();
    }
  }

  update(departureId: string, change: (log: TripLog) => TripLog): TripLog {
    const next = change(this.get(departureId));
    try {
      localStorage.setItem(key(departureId), JSON.stringify(next));
    } catch {
      // storage full: the change is lost on reload, so export the report soon
    }
    this.version.update((v) => v + 1);
    return next;
  }

  report(departureId: string, coordinatorId: string): TripReport {
    const log = this.get(departureId);
    return {
      kind: 'aac-trip-report',
      version: 1,
      departureId,
      coordinatorId,
      generatedAt: new Date().toISOString(),
      attendance: log.attendance,
      checkedIn: log.checkedIn,
      announcements: log.announcements,
      incidents: log.incidents,
      expenses: log.expenses,
      dailyReports: log.dailyReports,
      completedAt: log.completedAt,
      finalSummary: log.finalSummary,
    };
  }
}
