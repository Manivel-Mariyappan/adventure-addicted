import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

export interface BarDatum {
  label: string;
  value: number;
  // formatted value for labels and the tooltip
  display: string;
  // extra line in the tooltip, e.g. "12 of 20 seats"
  detail?: string;
}

// One-series bar chart: columns over time, or horizontal bars for a ranking.
// Class names avoid Bootstrap's .col and .row, which the admin loads.
// Bars are capped at 24px with a 4px rounded end; values are labelled sparingly
// (the highest and the last column), the rest are in the tooltip and the table.
@Component({
  selector: 'admin-bar-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (orientation() === 'column') {
      <div class="columns" [style.height.px]="height()" (mouseleave)="hover.set(null)">
        <div class="grid" aria-hidden="true"><span></span><span></span><span></span></div>
        @for (d of data(); track d.label; let i = $index; let last = $last) {
          <div
            class="slot"
            (mouseenter)="hover.set(i)"
            (focus)="hover.set(i)"
            tabindex="0"
            [attr.aria-label]="d.label + ': ' + d.display"
          >
            @if (i === peak() || last) {
              <span class="cap">{{ d.display }}</span>
            }
            <span
              class="column"
              [style.height.%]="pct(d.value)"
              [class.active]="hover() === i"
            ></span>
            <span class="tick">{{ d.label }}</span>
            @if (hover() === i) {
              <span class="tip" role="tooltip">
                <strong>{{ d.label }}</strong>
                {{ d.display }}
                @if (d.detail) {
                  <small>{{ d.detail }}</small>
                }
              </span>
            }
          </div>
        }
      </div>
    } @else {
      <div class="bars" (mouseleave)="hover.set(null)">
        @for (d of data(); track d.label; let i = $index) {
          <div
            class="bar-row"
            (mouseenter)="hover.set(i)"
            tabindex="0"
            [attr.aria-label]="d.label + ': ' + d.display"
          >
            <span class="name">{{ d.label }}</span>
            <span class="track">
              <span
                class="bar"
                [style.width.%]="pct(d.value)"
                [class.active]="hover() === i"
              ></span>
              <span class="val">{{ d.display }}</span>
            </span>
            @if (hover() === i && d.detail) {
              <span class="tip" role="tooltip">{{ d.detail }}</span>
            }
          </div>
        } @empty {
          <p class="empty">No data yet.</p>
        }
      </div>
    }
    <table class="visually-hidden">
      <caption>
        {{
          caption()
        }}
      </caption>
      <tbody>
        @for (d of data(); track d.label) {
          <tr>
            <th scope="row">{{ d.label }}</th>
            <td>{{ d.display }}</td>
            <td>{{ d.detail ?? '' }}</td>
          </tr>
        }
      </tbody>
    </table>
  `,
  styles: `
    :host {
      display: block;
      position: relative;
      --series: #1e5aa8;
      --series-hover: #174a8b;
      --grid: #eef1f5;
    }
    .visually-hidden {
      position: absolute !important;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
    }
    .columns {
      position: relative;
      display: flex;
      align-items: flex-end;
      gap: 2px;
      padding: 1.4rem 0 1.4rem;
    }
    .grid {
      position: absolute;
      inset: 1.4rem 0 1.4rem;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      pointer-events: none;
    }
    .grid span {
      border-top: 1px solid var(--grid);
    }
    .grid span:last-child {
      border-top-color: #cbd5e1;
    }
    .slot {
      position: relative;
      flex: 1;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      align-items: center;
      outline: none;
    }
    .column {
      width: min(24px, 70%);
      min-height: 2px;
      background: var(--series);
      border-radius: 4px 4px 0 0;
    }
    .column.active {
      background: var(--series-hover);
    }
    .cap {
      margin-bottom: 0.2rem;
      font-size: 0.7rem;
      font-weight: 600;
      color: #334155;
      white-space: nowrap;
    }
    .tick {
      position: absolute;
      bottom: -1.3rem;
      font-size: 0.68rem;
      color: #64748b;
      white-space: nowrap;
    }
    .tip {
      position: absolute;
      bottom: calc(100% - 1rem);
      left: 50%;
      z-index: 2;
      transform: translateX(-50%);
      display: flex;
      flex-direction: column;
      padding: 0.35rem 0.55rem;
      font-size: 0.75rem;
      white-space: nowrap;
      color: #fff;
      background: #0f1f3d;
      border-radius: 6px;
      pointer-events: none;
    }
    .tip small {
      color: #cbd5e1;
    }
    .bars {
      display: grid;
      gap: 0.55rem;
    }
    .bar-row {
      position: relative;
      display: grid;
      grid-template-columns: minmax(90px, 34%) 1fr;
      gap: 0.6rem;
      align-items: center;
      outline: none;
    }
    .name {
      overflow: hidden;
      font-size: 0.8rem;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: #334155;
    }
    .track {
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }
    .bar {
      height: 14px;
      min-width: 2px;
      background: var(--series);
      border-radius: 0 4px 4px 0;
    }
    .bar.active {
      background: var(--series-hover);
    }
    .val {
      font-size: 0.75rem;
      font-weight: 600;
      color: #334155;
      white-space: nowrap;
    }
    .bar-row .tip {
      bottom: 100%;
      left: 40%;
      transform: none;
    }
    .empty {
      margin: 0;
      font-size: 0.85rem;
      color: #64748b;
    }
  `,
})
export class BarChart {
  readonly data = input.required<BarDatum[]>();
  readonly orientation = input<'column' | 'bar'>('column');
  readonly height = input(200);
  readonly caption = input('');

  readonly hover = signal<number | null>(null);
  private readonly max = computed(() => Math.max(0, ...this.data().map((d) => d.value)));
  readonly peak = computed(() => {
    const values = this.data().map((d) => d.value);
    return values.indexOf(Math.max(...values));
  });

  pct(value: number): number {
    const max = this.max();
    // leave room for the value label above the tallest column / after the longest bar
    return max ? (value / max) * 82 : 0;
  }
}
