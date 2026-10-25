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

  readonly destinations = computed(
    () => this.drafts().destinations ?? this.published.destinations(),
  );
  readonly tours = computed(() => this.drafts().tours ?? this.published.tours());
  readonly departures = computed(() => this.drafts().departures ?? this.published.departures());
  readonly coordinators = computed(
    () => this.drafts().coordinators ?? this.published.coordinators(),
  );
  readonly settings = computed(() => this.drafts().settings ?? this.published.settings());

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
  }

  discardDraft(kind: DraftKind): void {
    try {
      localStorage.removeItem(DRAFT_KEYS[kind]);
    } catch {
      // storage unavailable, nothing to remove
    }
    this.drafts.update((d) => ({ ...d, [kind]: null }));
  }

  isDraft(kind: DraftKind): boolean {
    return this.drafts()[kind] !== null;
  }
}
