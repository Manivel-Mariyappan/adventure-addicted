import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ItineraryDay } from '../../core/models';
import { Icon } from '../icons';

// day-by-day timeline, day 1 open to start with
@Component({
  selector: 'app-itinerary',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, Icon],
  template: `
    <ol>
      @for (d of days(); track d.day) {
        <li [class.open]="open().has(d.day)">
          <button
            type="button"
            class="head"
            (click)="toggle(d.day)"
            [attr.aria-expanded]="open().has(d.day)"
          >
            <span class="num">Day {{ d.day }}</span>
            <span class="title">
              {{ d.title }}
              <small>{{ d.location }}</small>
            </span>
            <app-icon name="chevron-down" [size]="18" />
          </button>
          <div class="body">
            <p>{{ d.description }}</p>
            @if (d.activities.length) {
              <ul class="activities">
                @for (a of d.activities; track a) {
                  <li>{{ a }}</li>
                }
              </ul>
            }
            <dl>
              @if (d.distanceKm) {
                <div>
                  <dt><app-icon name="route" [size]="15" /> Distance</dt>
                  <dd>{{ d.distanceKm }} km</dd>
                </div>
              }
              @if (d.altitudeM) {
                <div>
                  <dt><app-icon name="altitude" [size]="15" /> Highest point</dt>
                  <dd>{{ d.altitudeM | number }} m</dd>
                </div>
              }
              @if (d.stay) {
                <div>
                  <dt><app-icon name="bed" [size]="15" /> Stay</dt>
                  <dd>{{ d.stay }}</dd>
                </div>
              }
              @if (d.meals) {
                <div>
                  <dt><app-icon name="meal" [size]="15" /> Meals</dt>
                  <dd>{{ d.meals }}</dd>
                </div>
              }
            </dl>
          </div>
        </li>
      }
    </ol>
  `,
  styleUrl: './itinerary.scss',
})
export class Itinerary {
  readonly days = input.required<ItineraryDay[]>();
  readonly open = signal(new Set<number>([1]));

  toggle(day: number): void {
    this.open.update((set) => {
      const next = new Set(set);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  }

  expandAll(): void {
    this.open.set(new Set(this.days().map((d) => d.day)));
  }
}
