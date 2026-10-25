import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ContentStore } from '../../app/core/services/content-store';
import { daysBetween, formatRange, todayIso } from '../../app/core/utils/dates';
import { CoordinatorAuthService } from '../core/coordinator-auth.service';
import { TripLogService } from '../core/trip-log.service';

@Component({
  selector: 'app-my-departures',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <h1 class="h4 mb-3">Hello {{ auth.coordinator()?.name?.split(' ')?.[0] }}</h1>

    @for (group of groups(); track group.title) {
      @if (group.trips.length) {
        <h2 class="h6 text-uppercase text-body-secondary mt-4 mb-2">{{ group.title }}</h2>
        <div class="vstack gap-2">
          @for (t of group.trips; track t.id) {
            <a
              class="card border-0 shadow-sm p-3 text-decoration-none text-body"
              [routerLink]="['/coordinator/trips', t.id]"
            >
              <div class="d-flex align-items-start gap-2">
                <div class="flex-grow-1">
                  <div class="fw-semibold">{{ t.tour }}</div>
                  <div class="small text-body-secondary">{{ t.dates }} · {{ t.code }}</div>
                </div>
                <span class="badge" [class]="t.badgeClass">{{ t.badge }}</span>
              </div>
              <div class="small mt-2" [class.text-danger]="!t.hasPack">
                {{ t.hasPack ? t.passengers + ' passengers loaded' : 'Trip pack not loaded yet' }}
              </div>
            </a>
          }
        </div>
      }
    }

    @if (!total()) {
      <div class="card border-0 shadow-sm p-4 text-center text-body-secondary">
        No departures are assigned to you yet. The office assigns them on the departure page.
      </div>
    }
  `,
})
export class MyDepartures {
  readonly auth = inject(CoordinatorAuthService);
  private readonly store = inject(ContentStore);
  private readonly logs = inject(TripLogService);

  private readonly trips = computed(() => {
    this.logs.version();
    const today = todayIso();
    const tours = new Map(this.store.tours().map((t) => [t.id, t.name]));
    return this.store
      .departures()
      .filter((d) => d.coordinatorId === this.auth.coordinatorId() && d.status !== 'cancelled')
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
      .map((d) => {
        const log = this.logs.get(d.id);
        const running = d.startDate <= today && d.endDate >= today;
        const done = !!log.completedAt || d.endDate < today || d.status === 'completed';
        const days = daysBetween(today, d.startDate);
        return {
          id: d.id,
          code: d.code,
          tour: tours.get(d.tourId) ?? '',
          dates: formatRange(d.startDate, d.endDate),
          hasPack: !!log.pack,
          passengers: log.pack?.passengers.length ?? 0,
          state: done ? 'done' : running ? 'running' : 'upcoming',
          badge: done
            ? log.completedAt
              ? 'Completed'
              : 'Finished'
            : running
              ? 'On the road'
              : `In ${days} days`,
          badgeClass: done ? 'text-bg-secondary' : running ? 'text-bg-success' : 'text-bg-primary',
        };
      });
  });

  readonly groups = computed(() => [
    { title: 'On the road', trips: this.trips().filter((t) => t.state === 'running') },
    { title: 'Coming up', trips: this.trips().filter((t) => t.state === 'upcoming') },
    {
      title: 'Past trips',
      trips: this.trips()
        .filter((t) => t.state === 'done')
        .reverse(),
    },
  ]);
  readonly total = computed(() => this.trips().length);
}
