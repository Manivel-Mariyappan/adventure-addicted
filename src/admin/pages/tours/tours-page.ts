import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef } from 'ag-grid-community';
import { TourPackage, TourStatus } from '../../../app/core/models';
import { ContentStore } from '../../../app/core/services/content-store';
import { todayIso } from '../../../app/core/utils/dates';
import { formatInr } from '../../../app/core/utils/price';
import { startingPrice } from '../../../app/core/utils/trip-rules';
import { AdminAlerts } from '../../core/alerts.service';
import { newId } from '../../core/local-collection';
import {
  adminGridTheme,
  badge,
  pinRightOnWideScreens,
  rowButtons,
  thumbnail,
} from '../../shared/grid';

const STATUS_COLORS: Record<TourStatus, string> = {
  published: 'success',
  draft: 'secondary',
  archived: 'dark',
};

@Component({
  selector: 'app-tours-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AgGridAngular],
  template: `
    <div class="d-flex flex-wrap gap-2 mb-3" role="group" aria-label="Filter by status">
      @for (s of statuses; track s.key) {
        <button
          type="button"
          class="btn btn-sm"
          [class]="status() === s.key ? 'btn-dark' : 'btn-outline-secondary'"
          (click)="status.set(s.key)"
        >
          {{ s.label }}
          <span class="badge text-bg-light ms-1">{{ count(s.key) }}</span>
        </button>
      }
    </div>
    <div class="card border-0 shadow-sm">
      <div class="card-header bg-white d-flex flex-wrap align-items-center gap-2 py-3">
        <input
          type="search"
          class="form-control form-control-sm"
          style="max-width: 300px"
          placeholder="Search by name or code"
          (input)="search.set($any($event.target).value)"
        />
        <button
          type="button"
          class="btn btn-sm btn-primary ms-auto"
          (click)="router.navigate(['/admin/tours', 'new'])"
        >
          + New tour package
        </button>
      </div>
      <ag-grid-angular
        style="display: block; height: calc(100vh - 290px); min-height: 380px"
        [theme]="theme"
        [rowData]="rows()"
        [columnDefs]="columns"
        [defaultColDef]="{
          sortable: true,
          filter: true,
          resizable: true,
          suppressHeaderMenuButton: true,
        }"
        [getRowId]="getRowId"
        [quickFilterText]="search()"
        [rowHeight]="60"
      />
    </div>
  `,
})
export class ToursPage {
  readonly router = inject(Router);
  private readonly store = inject(ContentStore);
  private readonly alerts = inject(AdminAlerts);

  readonly theme = adminGridTheme;
  readonly search = signal('');
  readonly status = signal<TourStatus | 'all'>('all');
  readonly getRowId = (p: { data: TourPackage }) => p.data.id;
  readonly statuses: { key: TourStatus | 'all'; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'published', label: 'Published' },
    { key: 'draft', label: 'Draft' },
    { key: 'archived', label: 'Archived' },
  ];

  readonly rows = computed(() => {
    const s = this.status();
    return s === 'all' ? this.store.tours() : this.store.tours().filter((t) => t.status === s);
  });

  private readonly upcoming = computed(() => {
    const counts = new Map<string, number>();
    const today = todayIso();
    for (const d of this.store.departures()) {
      if (d.status === 'scheduled' && d.startDate >= today) {
        counts.set(d.tourId, (counts.get(d.tourId) ?? 0) + 1);
      }
    }
    return counts;
  });

  count(key: TourStatus | 'all'): number {
    return key === 'all'
      ? this.store.tours().length
      : this.store.tours().filter((t) => t.status === key).length;
  }

  readonly columns: ColDef<TourPackage>[] = [
    {
      headerName: '',
      field: 'coverImage',
      width: 80,
      sortable: false,
      filter: false,
      cellRenderer: thumbnail(),
    },
    { headerName: 'Code', field: 'code', width: 100 },
    { headerName: 'Tour', field: 'name', flex: 1.4, minWidth: 220 },
    { headerName: 'Days', field: 'days', width: 85 },
    { headerName: 'Difficulty', field: 'difficulty', width: 120 },
    {
      headerName: 'From',
      colId: 'price',
      width: 120,
      valueGetter: (p) => (p.data ? startingPrice(p.data) : 0),
      valueFormatter: (p) => formatInr(p.value as number),
    },
    {
      headerName: 'Upcoming dates',
      colId: 'upcoming',
      width: 150,
      valueGetter: (p) => this.upcoming().get(p.data?.id ?? '') ?? 0,
    },
    { headerName: 'Status', field: 'status', width: 120, cellRenderer: badge(STATUS_COLORS) },
    {
      headerName: 'Actions',
      colId: 'actions',
      width: 290,
      sortable: false,
      filter: false,
      pinned: pinRightOnWideScreens(),
      cellRenderer: rowButtons<TourPackage>((t) => [
        {
          label: 'Edit',
          className: 'btn-outline-primary',
          onClick: () => void this.router.navigate(['/admin/tours', t.id]),
        },
        {
          label: 'Duplicate',
          className: 'btn-outline-secondary',
          onClick: () => this.duplicate(t),
        },
        t.status === 'published'
          ? {
              label: 'Archive',
              className: 'btn-outline-dark',
              onClick: () => void this.setStatus(t, 'archived'),
            }
          : {
              label: 'Publish',
              className: 'btn-outline-success',
              onClick: () => void this.setStatus(t, 'published'),
            },
        { label: 'Delete', className: 'btn-outline-danger', onClick: () => void this.remove(t) },
      ]),
    },
  ];

  duplicate(t: TourPackage): void {
    const now = new Date().toISOString();
    const copy: TourPackage = {
      ...structuredClone(t),
      id: newId('tour'),
      code: `${t.code}C`,
      slug: `${t.slug}-copy`,
      name: `${t.name} (copy)`,
      status: 'draft',
      featured: false,
      createdAt: now,
      updatedAt: now,
    };
    this.store.saveDraft('tours', [...this.store.tours(), copy]);
    void this.router.navigate(['/admin/tours', copy.id]);
  }

  async setStatus(t: TourPackage, status: TourStatus): Promise<void> {
    const text =
      status === 'archived'
        ? 'It disappears from the website. Existing bookings are not affected.'
        : 'It appears on the website with its upcoming departures.';
    if (
      !(await this.alerts.confirm(
        `${status === 'archived' ? 'Archive' : 'Publish'} ${t.name}?`,
        text,
        'Yes',
      ))
    )
      return;
    this.store.saveDraft(
      'tours',
      this.store
        .tours()
        .map((x) => (x.id === t.id ? { ...x, status, updatedAt: new Date().toISOString() } : x)),
    );
    void this.alerts.toast(`${t.name} ${status}`);
  }

  async remove(t: TourPackage): Promise<void> {
    if (this.store.departures().some((d) => d.tourId === t.id)) {
      void this.alerts.error(
        'This tour has departures',
        'Archive it instead, so past bookings and reports keep their tour.',
      );
      return;
    }
    if (
      !(await this.alerts.confirmDelete(
        `Delete ${t.name}?`,
        'The package and its itinerary are removed.',
      ))
    )
      return;
    this.store.saveDraft(
      'tours',
      this.store.tours().filter((x) => x.id !== t.id),
    );
    void this.alerts.toast('Tour deleted');
  }
}
