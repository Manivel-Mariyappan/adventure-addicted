import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ContentStore, DraftKind } from '../../../app/core/services/content-store';
import { downloadJson } from '../../../app/core/utils/download';
import { AdminDataService } from '../../core/admin-data.service';
import { AdminAlerts } from '../../core/alerts.service';
import { statusEntries, withLiveSeats } from '../../core/ledger';
import { AdminCard } from '../../shared/admin-card';

interface DataFile {
  kind: DraftKind | 'booking-status';
  file: string;
  label: string;
  note: string;
}

@Component({
  selector: 'app-publish-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AdminCard],
  template: `
    <admin-card
      heading="Data files"
      subtitle="The website has no server: changes go live by replacing these files and redeploying"
      icon="⇪"
    >
      <div class="list-group list-group-flush">
        @for (f of files; track f.kind) {
          <div class="list-group-item d-flex flex-wrap align-items-center gap-3 px-0">
            <div class="flex-grow-1">
              <div class="fw-semibold">{{ f.label }}</div>
              <code class="small">public/data/{{ f.file }}</code>
              <div class="small text-body-secondary">{{ f.note }}</div>
            </div>
            @if (changed(f.kind)) {
              <span class="badge text-bg-warning">Changed</span>
            } @else {
              <span class="badge text-bg-light border">No changes</span>
            }
            <div class="d-flex gap-2">
              <button type="button" class="btn btn-sm btn-primary" (click)="download(f)">
                Download
              </button>
              @if (f.kind !== 'booking-status' && store.isDraft(f.kind)) {
                <button type="button" class="btn btn-sm btn-outline-danger" (click)="discard(f)">
                  Discard draft
                </button>
              }
            </div>
          </div>
        }
      </div>
      <div card-footer>
        Drafts live only in this browser. Clearing browser data deletes them, so download your files
        first.
      </div>
    </admin-card>

    <div class="row g-3">
      <div class="col-lg-6">
        <admin-card heading="How to publish" icon="?">
          <ol class="mb-0">
            <li>Download each changed file.</li>
            <li>
              Replace the file with the same name in the project's <code>public/data/</code> folder.
            </li>
            <li>If you added photos by path, copy them into <code>public/images/</code> too.</li>
            <li>
              Run <code>npm run build</code> and deploy, or push to Git if your host deploys
              automatically.
            </li>
            <li>When the new version is live, discard the drafts here.</li>
          </ol>
        </admin-card>
      </div>
      <div class="col-lg-6">
        <admin-card
          heading="Backup"
          subtitle="Bookings, payments and departure notes are private and never published"
          icon="⛁"
        >
          <p class="small">
            They are stored in this browser only. Download a backup regularly, and restore it on
            another computer to continue from there.
          </p>
          <div class="d-flex flex-wrap gap-2">
            <button type="button" class="btn btn-sm btn-outline-primary" (click)="backup()">
              Download backup
            </button>
            <label class="btn btn-sm btn-outline-secondary mb-0">
              Restore backup
              <input #file type="file" accept="application/json" hidden (change)="restore(file)" />
            </label>
          </div>
        </admin-card>
      </div>
    </div>
  `,
})
export class PublishPage {
  readonly store = inject(ContentStore);
  private readonly data = inject(AdminDataService);
  private readonly alerts = inject(AdminAlerts);

  readonly files: DataFile[] = [
    {
      kind: 'tours',
      file: 'tours.json',
      label: 'Tour packages',
      note: 'Itineraries, prices and options.',
    },
    {
      kind: 'departures',
      file: 'departures.json',
      label: 'Departures and seats',
      note: 'Seat counts are taken from your bookings when you download.',
    },
    { kind: 'destinations', file: 'destinations.json', label: 'Destinations', note: '' },
    {
      kind: 'coordinators',
      file: 'coordinators.json',
      label: 'Coordinators',
      note: 'Name, bio and phone. The phone is shown only on confirmed trips.',
    },
    {
      kind: 'settings',
      file: 'settings.json',
      label: 'Company settings',
      note: 'Contact, WhatsApp, GST and payment terms.',
    },
    {
      kind: 'booking-status',
      file: 'booking-status.json',
      label: 'Booking status',
      note: 'Reference, status and amounts only, for My trips. No names or phone numbers.',
    },
  ];

  // published seat counts that differ from the bookings
  private readonly seatsChanged = computed(() =>
    this.store.departures().some((d) => {
      const live = withLiveSeats(d, this.data.bookings.all()).seatsTaken;
      const keys = new Set([...Object.keys(live), ...Object.keys(d.seatsTaken)]);
      return [...keys].some((k) => (live[k] ?? 0) !== (d.seatsTaken[k] ?? 0));
    }),
  );

  changed(kind: DataFile['kind']): boolean {
    if (kind === 'booking-status') return this.data.bookings.all().some((b) => !b.demo);
    if (kind === 'departures') return this.store.isDraft('departures') || this.seatsChanged();
    return this.store.isDraft(kind);
  }

  download(f: DataFile): void {
    const bookings = this.data.bookings.all();
    const content = {
      tours: () => this.store.tours(),
      departures: () => this.store.departures().map((d) => withLiveSeats(d, bookings)),
      destinations: () => this.store.destinations(),
      coordinators: () => this.store.coordinators(),
      settings: () => this.store.settings(),
      'booking-status': () => statusEntries(bookings),
    }[f.kind]();
    downloadJson(f.file, content);
    void this.alerts.toast(`${f.file} downloaded`);
  }

  async discard(f: DataFile): Promise<void> {
    if (f.kind === 'booking-status') return;
    const ok = await this.alerts.confirmDelete(
      `Discard changes to ${f.label}?`,
      'Download the file first if you want to keep them.',
    );
    if (!ok) return;
    this.store.discardDraft(f.kind);
    void this.alerts.toast('Draft discarded');
  }

  backup(): void {
    const date = new Date().toISOString().slice(0, 10);
    downloadJson(`adventure-addicted-backup-${date}.json`, {
      kind: 'aac-backup',
      createdAt: new Date().toISOString(),
      bookings: this.data.bookings.all(),
      ops: this.data.ops.all(),
      users: this.data.users.all(),
    });
  }

  async restore(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      const backup = JSON.parse(await file.text());
      if (backup?.kind !== 'aac-backup') throw new Error('not a backup');
      const ok = await this.alerts.confirmDelete(
        'Replace all bookings with this backup?',
        `${backup.bookings.length} bookings from ${backup.createdAt.slice(0, 10)}. What is in this browser now is replaced.`,
      );
      if (!ok) return;
      this.data.bookings.setAll(backup.bookings);
      this.data.ops.setAll(backup.ops ?? []);
      if (backup.users?.length) this.data.users.setAll(backup.users);
      void this.alerts.success('Backup restored', `${backup.bookings.length} bookings`);
    } catch {
      void this.alerts.error(
        'Could not read this file',
        'Choose a backup downloaded from this page.',
      );
    }
  }
}
