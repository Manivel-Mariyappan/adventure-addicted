import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { ItineraryDay } from '../../core/models';
import { Icon } from '../icons';
import { SceneTheme } from '../mountain-scene/mountain-engine';
import { MountainScene } from '../mountain-scene/mountain-scene';

// "Watch the route": a 3D fly-along of the itinerary with a caption for each day.
// The terrain rises where the itinerary's altitudes are high.
@Component({
  selector: 'app-route-preview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, Icon, MountainScene],
  template: `
    <div class="stage">
      <app-mountain-scene
        [theme]="theme()"
        time="day"
        [markers]="markers()"
        [duration]="days().length * 6"
        [autoplay]="false"
        (progress)="progress.set($event)"
        (loaded)="available.set($event)"
      >
        <img class="poster" [src]="poster()" alt="" loading="lazy" />
      </app-mountain-scene>

      @if (current(); as d) {
        <div class="caption" aria-live="polite">
          <span class="day">Day {{ d.day }}</span>
          <strong>{{ d.title }}</strong>
          <span class="meta">
            {{ d.location }}
            @if (d.altitudeM) {
              · {{ d.altitudeM | number }} m
            }
            @if (d.distanceKm) {
              · {{ d.distanceKm }} km
            }
          </span>
        </div>
      }

      @if (available() !== false) {
        <button
          type="button"
          class="play"
          (click)="toggle()"
          [attr.aria-label]="playing() ? 'Pause' : 'Play the route'"
        >
          @if (playing()) {
            <span class="pause-icon" aria-hidden="true"></span>
          } @else {
            <span class="play-icon" aria-hidden="true"></span>
          }
        </button>
      }
    </div>

    @if (available() !== false) {
      <div class="controls">
        <input
          type="range"
          min="0"
          max="1000"
          [value]="progress() * 1000"
          (input)="seek(+$any($event.target).value / 1000)"
          aria-label="Position along the route"
        />
        <div class="days" role="group" aria-label="Jump to a day">
          @for (d of days(); track d.day; let i = $index) {
            <button type="button" [class.on]="current()?.day === d.day" (click)="jump(i)">
              {{ d.day }}
            </button>
          }
        </div>
      </div>
    } @else {
      <p class="note">
        <app-icon name="info" [size]="15" /> The 3D route needs a browser with WebGL.
      </p>
    }
  `,
  styleUrl: './route-preview.scss',
})
export class RoutePreview {
  readonly days = input.required<ItineraryDay[]>();
  readonly theme = input<SceneTheme>('ladakh');
  readonly poster = input('art/hero.svg');

  private readonly scene = viewChild.required(MountainScene);
  readonly progress = signal(0);
  readonly playing = signal(false);
  readonly available = signal<boolean | null>(null);

  readonly markers = computed(() => this.days().map((d) => ({ altitudeM: d.altitudeM })));
  readonly current = computed(() => {
    const list = this.days();
    if (!list.length) return null;
    return list[Math.min(list.length - 1, Math.round(this.progress() * (list.length - 1)))];
  });

  toggle(): void {
    this.playing.update((p) => !p);
    if (this.playing()) this.scene().play();
    else this.scene().pause();
  }

  seek(progress: number): void {
    // stop just before the end so the loop doesn't jump back to day 1
    this.scene().seek(Math.min(progress, 0.999));
  }

  jump(index: number): void {
    this.seek(index / Math.max(1, this.days().length - 1));
  }
}
