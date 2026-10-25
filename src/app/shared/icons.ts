import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

// circle as a path, so every icon is just a list of paths
const circle = (cx: number, cy: number, r: number) =>
  `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0`;

// 24x24 line icons, 1.6 stroke
const PATHS = {
  phone: [
    'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2',
  ],
  pin: ['M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z', circle(12, 9.5, 2.5)],
  clock: [circle(12, 12, 9), 'M12 7v5l3 2'],
  mail: ['M3 5h18v14H3z', 'm3 7 9 6 9-6'],
  search: [circle(11, 11, 7), 'm20 20-3.5-3.5'],
  'arrow-left': ['M19 12H5m6-6-6 6 6 6'],
  'arrow-right': ['M5 12h14m-6-6 6 6-6 6'],
  'chevron-down': ['m6 9 6 6 6-6'],
  close: ['M6 6l12 12M18 6 6 18'],
  menu: ['M4 8h16M4 16h16'],
  check: ['m5 12 4.5 4.5L19 7'],
  calendar: ['M4 6h16v14H4z', 'M4 10h16M8 3v4M16 3v4'],
  users: [
    circle(9, 8, 3.5),
    'M2.5 20a6.5 6.5 0 0 1 13 0',
    'M16 4.5a3.5 3.5 0 0 1 0 7M18.5 20a6.5 6.5 0 0 0-3-5.5',
  ],
  user: [circle(12, 8, 4), 'M4 21a8 8 0 0 1 16 0'],
  mountain: ['M2 20 9 7l4 7 3-4 6 10Z', 'm7.5 10 1.5 1.5L10.5 10'],
  bike: [
    circle(5.5, 16, 3.5),
    circle(18.5, 16, 3.5),
    'M5.5 16 9 9h5l4.5 7M9 9l3 7h-2',
    'M14 9l1-3h3',
  ],
  car: ['M3 16v-4l2.5-5h13l2.5 5v4Z', 'M3 12h18', circle(7, 16.5, 1.8), circle(17, 16.5, 1.8)],
  plane: [
    'M10.5 13 4 15v-2l6.5-4.5V4a1.5 1.5 0 0 1 3 0v4.5L20 13v2l-6.5-2v4l2 1.5V20L12 19l-3.5 1v-1.5l2-1.5Z',
  ],
  bed: ['M3 18V6M3 14h18v4M21 14v-3a3 3 0 0 0-3-3h-7v6', circle(7, 10.5, 2)],
  meal: ['M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10', 'M17 21V3c-2 1-3 4-3 7h3'],
  route: [circle(6, 18, 2.5), circle(18, 6, 2.5), 'M8.5 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.5'],
  altitude: ['m4 14 8-8 8 8', 'm4 20 8-8 8 8'],
  shield: ['M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6Z', 'm9 12 2 2 4-4'],
  info: [circle(12, 12, 9), 'M12 11v6M12 7.5v.5'],
  doc: ['M6 3h8l4 4v14H6Z', 'M14 3v4h4M9 12h6M9 16h6'],
  star: ['m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z'],
  flag: ['M5 21V4M5 4h11l-2 4 2 4H5'],
  download: ['M12 4v11m-5-5 5 5 5-5M5 20h14'],
  instagram: ['M4 4h16v16H4z', circle(12, 12, 4), 'M17 7h.01'],
  youtube: [
    'M3 7.5a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3Z',
    'm10 9 5 3-5 3Z',
  ],
  facebook: ['M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8Z'],
} satisfies Record<string, string[]>;

export type IconName = keyof typeof PATHS | 'whatsapp';

const WHATSAPP =
  'M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2Zm0 18.15a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24s8.23 3.7 8.23 8.24-3.69 8.24-8.23 8.24Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.25-.64.81-.78.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.13-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.13-.56-1.35-.76-1.85-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.22.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.14-1.18-.06-.11-.22-.17-.47-.29Z';

@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true', style: 'display:inline-flex;line-height:0' },
  template: `
    @if (name() === 'whatsapp') {
      <svg viewBox="0 0 24 24" [attr.width]="size()" [attr.height]="size()">
        <path fill="currentColor" [attr.d]="whatsapp" />
      </svg>
    } @else {
      <svg
        viewBox="0 0 24 24"
        [attr.width]="size()"
        [attr.height]="size()"
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        @for (d of paths(); track $index) {
          <path [attr.d]="d" />
        }
      </svg>
    }
  `,
})
export class Icon {
  readonly name = input.required<IconName>();
  readonly size = input(20);

  readonly whatsapp = WHATSAPP;
  readonly paths = computed(() => {
    const name = this.name();
    return name === 'whatsapp' ? [] : PATHS[name];
  });
}
