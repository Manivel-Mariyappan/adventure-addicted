import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

// Tibetan prayer flags on a sagging string, flapping as if on a moving bike.
// Scales to the width of its container; place it over a dark background.
@Component({
  selector: 'app-prayer-flags',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg viewBox="0 0 440 80" aria-hidden="true">
      <g class="line">
        <path d="M-10 26Q220 78 450 26" fill="none" stroke="#c9d2e3" stroke-width="1" />
        @for (f of flags(); track $index) {
          <g [attr.transform]="'translate(' + f.x + ' ' + f.y + ') rotate(' + f.angle + ')'">
            <rect
              x="-9"
              y="1"
              width="18"
              height="23"
              [attr.fill]="f.color"
              [style.animation-delay]="f.delay"
              [style.animation-duration]="f.duration"
            />
          </g>
        }
      </g>
    </svg>
  `,
  styles: `
    :host {
      display: block;
      pointer-events: none;
    }
    svg {
      display: block;
      width: 100%;
      height: auto;
      overflow: visible;
    }

    /* the string bobs as if the bike is going over bumps */
    .line {
      animation: bump 0.9s ease-in-out infinite;
    }

    /* each flag is blown back by the wind and flaps in gusts */
    rect {
      opacity: 0.95;
      transform-box: fill-box;
      transform-origin: top center;
      animation: wind 1.8s ease-in-out infinite;
    }

    @keyframes wind {
      0%,
      100% {
        transform: rotate(14deg) skewY(0deg) scaleX(1);
      }
      20% {
        transform: rotate(30deg) skewY(5deg) scaleX(0.86);
      }
      35% {
        transform: rotate(18deg) skewY(-4deg) scaleX(0.96);
      }
      55% {
        transform: rotate(34deg) skewY(6deg) scaleX(0.82);
      }
      70% {
        transform: rotate(16deg) skewY(-3deg) scaleX(0.98);
      }
      85% {
        transform: rotate(26deg) skewY(4deg) scaleX(0.9);
      }
    }

    @keyframes bump {
      0%,
      100% {
        transform: translateY(0);
      }
      30% {
        transform: translateY(1.5px);
      }
      60% {
        transform: translateY(-1px);
      }
    }

    /* still frame: flags leaning in the wind, no movement */
    @media (prefers-reduced-motion: reduce) {
      .line,
      rect {
        animation: none;
      }
      rect {
        transform: rotate(20deg);
      }
    }
  `,
})
export class PrayerFlags {
  readonly count = input(15);

  // blue, white, red, green, yellow, hanging from the string M-10 26 Q220 78 450 26
  // (x = -10 + 460t, y = 26 + 104t(1 - t)), each tilted to follow it
  readonly flags = computed(() =>
    Array.from({ length: this.count() }, (_, i) => {
      const t = (i + 1) / (this.count() + 1);
      return {
        x: -10 + 460 * t,
        y: 26 + 104 * t * (1 - t),
        angle: (Math.atan((104 * (1 - 2 * t)) / 460) * 180) / Math.PI,
        color: ['#2f6fd0', '#f4f1ea', '#d62839', '#2e9e5b', '#f5b700'][i % 5],
        // uneven timings so the flags don't flap in step
        delay: `${-((i * 0.37) % 1.9).toFixed(2)}s`,
        duration: `${1.5 + (i % 3) * 0.3}s`,
      };
    }),
  );
}
