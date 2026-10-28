import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { APP_CONFIG } from '../config/app-config';
import {
  BookingStatusEntry,
  CompanySettings,
  Coordinator,
  Departure,
  Destination,
  TourPackage,
} from '../models';
import { assetUrl } from '../utils/url';

type LoadState = 'loading' | 'ready' | 'error';

const DRAFT_KEYS = {
  destinations: 'aac.draft.destinations',
  tours: 'aac.draft.tours',
  departures: 'aac.draft.departures',
  coordinators: 'aac.draft.coordinators',
  settings: 'aac.draft.settings',
} as const;
export type DraftKind = keyof typeof DRAFT_KEYS;

interface DraftValues {
  destinations: Destination[];
  tours: TourPackage[];
  departures: Departure[];
  coordinators: Coordinator[];
  settings: CompanySettings;
}

// Short hash of a data file's contents, to notice when the file changed after a draft began.
function fingerprint(value: unknown): string {
  const text = JSON.stringify(value);
  let hash = 5381;
  for (let i = 0; i < text.length; i++) hash = (hash * 33) ^ text.charCodeAt(i);
  return (hash >>> 0).toString(36);
}

// the fingerprint of the published file each draft was started from
const baseKey = (kind: DraftKind) => `${DRAFT_KEYS[kind]}.base`;

function readBase(kind: DraftKind): string | null {
  try {
    return localStorage.getItem(baseKey(kind));
  } catch {
    return null;
  }
}

function readDraft<K extends DraftKind>(kind: K): DraftValues[K] | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEYS[kind]);
    return raw ? (JSON.parse(raw) as DraftValues[K]) : null;
  } catch {
    return null;
  }
}

// Loads the site content from public/data/*.json.
// Admin edits are kept as drafts in localStorage, so only that browser sees them until the
// downloaded JSON files are deployed.
@Injectable({ providedIn: 'root' })
export class ContentStore {
  private readonly http = inject(HttpClient);

  readonly state = signal<LoadState>('loading');

  private readonly published = {
    destinations: signal<Destination[]>([]),
    tours: signal<TourPackage[]>([]),
    departures: signal<Departure[]>([]),
    coordinators: signal<Coordinator[]>([]),
    settings: signal<CompanySettings | null>(null),
  };
  readonly bookingStatus = signal<BookingStatusEntry[]>([]);

  private readonly drafts = signal<{ [K in DraftKind]: DraftValues[K] | null }>({
    destinations: readDraft('destinations'),
    tours: readDraft('tours'),
    departures: readDraft('departures'),
    coordinators: readDraft('coordinators'),
    settings: readDraft('settings'),
  });

  private readonly bases = signal<Record<DraftKind, string | null>>({
    destinations: readBase('destinations'),
    tours: readBase('tours'),
    departures: readBase('departures'),
    coordinators: readBase('coordinators'),
    settings: readBase('settings'),
  });

  // Drafts whose JSON file has changed since the draft was started (or that predate this
  // check). The draft hides those changes until it is discarded or kept on purpose.
  readonly staleDrafts = computed(() => {
    if (this.state() !== 'ready') return [];
    return (Object.keys(DRAFT_KEYS) as DraftKind[]).filter(
      (k) => this.drafts()[k] !== null && this.bases()[k] !== fingerprint(this.published[k]()),
    );
  });

  readonly destinations = computed(
    () => this.drafts().destinations ?? this.published.destinations(),
  );
  readonly tours = computed(() => this.drafts().tours ?? this.published.tours());
  readonly departures = computed(() => this.drafts().departures ?? this.published.departures());
  readonly coordinators = computed(
    () => this.drafts().coordinators ?? this.published.coordinators(),
  );
  readonly settings = computed(() => this.drafts().settings ?? this.published.settings());
  // the company logo for headers and sign-in pages
  readonly logo = computed(() => assetUrl(this.settings()?.logo || 'favicon.svg'));

  readonly hasDrafts = computed(() => Object.values(this.drafts()).some((d) => d !== null));
  readonly draftKinds = computed(() =>
    (Object.keys(DRAFT_KEYS) as DraftKind[]).filter((k) => this.drafts()[k] !== null),
  );

  private loading?: Promise<void>;

  constructor() {
    void this.load();
  }

  load(): Promise<void> {
    this.loading ??= this.fetchAll().finally(() => (this.loading = undefined));
    return this.loading;
  }

  private async fetchAll(): Promise<void> {
    this.state.set('loading');
    // skip the browser cache so new departures and seat counts show straight away
    const get = <T>(url: string) => firstValueFrom(this.http.get<T>(`${url}?v=${Date.now()}`));
    const urls = APP_CONFIG.dataUrls;
    try {
      const [destinations, tours, departures, coordinators, settings] = await Promise.all([
        get<Destination[]>(urls.destinations),
        get<TourPackage[]>(urls.tours),
        get<Departure[]>(urls.departures),
        get<Coordinator[]>(urls.coordinators),
        get<CompanySettings>(urls.settings),
      ]);
      this.published.destinations.set(destinations);
      this.published.tours.set(tours);
      this.published.departures.set(departures);
      this.published.coordinators.set(coordinators);
      this.published.settings.set(settings);
      this.state.set('ready');
    } catch (err) {
      console.error('[content] failed to load site data', err);
      this.state.set('error');
      return;
    }
    // optional: only My trips needs it, and it may not exist before the first publish
    get<BookingStatusEntry[]>(urls.bookingStatus).then(
      (list) => this.bookingStatus.set(list),
      () => this.bookingStatus.set([]),
    );
  }

  saveDraft<K extends DraftKind>(kind: K, value: DraftValues[K]): void {
    try {
      localStorage.setItem(DRAFT_KEYS[kind], JSON.stringify(value));
    } catch (err) {
      throw new Error(
        'This browser could not store the draft. Uploaded photos may be too large, so add them by path instead.',
        { cause: err },
      );
    }
    this.drafts.update((d) => ({ ...d, [kind]: value }));
    // the first edit records which version of the file the draft started from
    if (this.bases()[kind] === null) this.setBase(kind, fingerprint(this.published[kind]()));
  }

  // Keep the draft even though the file changed: stop warning until it changes again.
  keepDraft(kind: DraftKind): void {
    this.setBase(kind, fingerprint(this.published[kind]()));
  }

  private setBase(kind: DraftKind, value: string | null): void {
    try {
      if (value === null) localStorage.removeItem(baseKey(kind));
      else localStorage.setItem(baseKey(kind), value);
    } catch {
      // storage unavailable; the warning just shows again next time
    }
    this.bases.update((b) => ({ ...b, [kind]: value }));
  }

  discardDraft(kind: DraftKind): void {
    try {
      localStorage.removeItem(DRAFT_KEYS[kind]);
    } catch {
      // storage unavailable, nothing to remove
    }
    this.drafts.update((d) => ({ ...d, [kind]: null }));
    this.setBase(kind, null);
  }

  isDraft(kind: DraftKind): boolean {
    return this.drafts()[kind] !== null;
  }
}
