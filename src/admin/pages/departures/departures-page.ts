import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NgbOffcanvas } from '@ng-bootstrap/ng-bootstrap';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, ICellRendererParams } from 'ag-grid-community';
import { Departure } from '../../../app/core/models';
import { ContentStore } from '../../../app/core/services/content-store';
import { daysBetween, formatRange, todayIso } from '../../../app/core/utils/dates';
import { STATE_LABELS, departureState, seatsLeft } from '../../../app/core/utils/trip-rules';
import { AdminDataService } from '../../core/admin-data.service';
import { withLiveSeats } from '../../core/ledger';
import { adminGridTheme, pinRightOnWideScreens, rowButtons } from '../../shared/grid';
import { DepartureForm } from './departure-form';

interface Row {
  departure: Departure;
  tourName: string;
  dates: string;
  coordinator: string;
  taken: number;
  left: number;
  minimum: number;
  state: string;
  daysToGo: number;
}

const occupancy = (p: ICellRendererParams<Row>) => {
  const r = p.data;
  if (!r) return '';
  const pct = Math.round((r.taken / r.departure.totalSeats) * 100);
  const wrap = document.createElement('div');
  wrap.className = 'd-flex flex-column justify-content-center h-100 gap-1';
  wrap.innerHTML = `<span class="small">${r.taken} / ${r.departure.totalSeats}</span><div class="seat-bar ${r.left ? '' : 'full'}"><span style="width:${pct}%"></span></div>`;
  return wrap;
};

@Component({
  selector: 'app-departures-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AgGridAngular],
  template: `
    @if (shortOnes().length) {
      <div class="alert alert-warning d-flex flex-wrap gap-2 align-items-center">
        <strong>Below the minimum group size:</strong>
        @for (r of shortOnes(); track r.departure.id) {
          <button
            type="button"
            class="btn btn-sm btn-outline-dark"
            (click)="openDetail(r.departure)"
          >
            {{ r.departure.code }} · {{ r.taken }}/{{ r.minimum }} · {{ r.daysToGo }} days to go
          </button>
        }
      </div>
    }
    <div class="d-flex flex-wrap gap-2 mb-3" role="group" aria-label="Show">
      @for (v of views; track v.key) {
        <button
          type="button"
          class="btn btn-sm"
          [class]="view() === v.key ? 'btn-dark' : 'btn-outline-secondary'"
          (click)="view.set(v.key)"
        >
          {{ v.label }}
        </button>
      }
    </div>
    <div class="card border-0 shadow-sm">
      <div class="card-header bg-white d-flex flex-wrap align-items-center gap-2 py-3">
        <input
          type="search"
          class="form-control form-control-sm"
          style="max-width: 300px"
          placeholder="Search by code, tour or coordinator"
          (input)="search.set($any($event.target).value)"
        />
        <button type="button" class="btn btn-sm btn-primary ms-auto" (click)="open(null)">
          + Schedule departure
        </button>
      </div>
      <ag-grid-angular
        style="display: block; height: calc(100vh - 300px); min-height: 380px"
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
        [rowHeight]="58"
      />
    </div>
    <p class="small text-body-secondary mt-2">
      Seats come from your bookings: confirmed bookings and unpaid requests still within their hold.
      The website shows the counts from the last time you published departures.json.
    </p>
  `,
})
export class DeparturesPage {
  private readonly store = inject(ContentStore);
  private readonly data = inject(AdminDataService);
  private readonly offcanvas = inject(NgbOffcanvas);
  private readonly router = inject(Router);

  readonly theme = adminGridTheme;
  readonly search = signal('');
  readonly view = signal<'upcoming' | 'past' | 'all'>('upcoming');
  readonly views = [
    { key: 'upcoming' as const, label: 'Upcoming' },
    { key: 'past' as const, label: 'Past' },
    { key: 'all' as const, label: 'All' },
  ];
  readonly getRowId = (p: { data: Row }) => p.data.departure.id;

  private readonly all = computed<Row[]>(() => {
    const today = todayIso();
    const tours = new Map(this.store.tours().map((t) => [t.id, t]));
    const coordinators = new Map(this.store.coordinators().map((c) => [c.id, c.name]));
    return this.store.departures().map((d) => {
      const live = withLiveSeats(d, this.data.bookings.all());
      const taken = Object.values(live.seatsTaken).reduce((a, b) => a + b, 0);
      const tour = tours.get(d.tourId);
      return {
        departure: d,
        tourName: tour?.name ?? '(deleted tour)',
        dates: formatRange(d.startDate, d.endDate),
        coordinator: d.coordinatorId ? (coordinators.get(d.coordinatorId) ?? '') : '',
        taken,
        left: seatsLeft(live),
        minimum: tour?.minParticipants ?? 0,
        state: STATE_LABELS[departureState(live, today)],
        daysToGo: daysBetween(today, d.startDate),
      };
    });
  });

  readonly rows = computed(() => {
    const today = todayIso();
    const v = this.view();
    const list = this.all().filter((r) =>
      v === 'all'
        ? true
        : v === 'upcoming'
          ? r.departure.endDate >= today
          : r.departure.endDate < today,
    );
    return list.sort((a, b) =>
      v === 'past'
        ? b.departure.startDate.localeCompare(a.departure.startDate)
        : a.departure.startDate.localeCompare(b.departure.startDate),
    );
  });

  // scheduled in the next 45 days and still short of the tour's minimum
  readonly shortOnes = computed(() =>
    this.all().filter(
      (r) =>
        r.departure.status === 'scheduled' &&
        r.daysToGo >= 0 &&
        r.daysToGo <= 45 &&
        r.taken < r.minimum,
    ),
  );

  readonly columns: ColDef<Row>[] = [
    { headerName: 'Code', valueGetter: (p) => p.data?.departure.code, width: 145 },
    { headerName: 'Tour', field: 'tourName', flex: 1.3, minWidth: 200 },
    {
      headerName: 'Dates',
      field: 'dates',
      width: 190,
      comparator: (_a, _b, x, y) =>
        (x.data?.departure.startDate ?? '').localeCompare(y.data?.departure.startDate ?? ''),
    },
    {
      headerName: 'Coordinator',
      field: 'coordinator',
      width: 160,
      valueFormatter: (p) => p.value || '— not assigned',
    },
    {
      headerName: 'Seats',
      colId: 'seats',
      width: 130,
      valueGetter: (p) => p.data?.taken,
      cellRenderer: occupancy,
    },
    { headerName: 'Left', field: 'left', width: 85 },
    { headerName: 'Status', field: 'state', width: 160 },
    {
      headerName: 'Actions',
      colId: 'actions',
      width: 150,
      sortable: false,
      filter: false,
      pinned: pinRightOnWideScreens(),
      cellRenderer: rowButtons<Row>((r) => [
        {
          label: 'Open',
          className: 'btn-outline-primary',
          onClick: () => this.openDetail(r.departure),
        },
        {
          label: 'Edit',
          className: 'btn-outline-secondary',
          onClick: () => this.open(r.departure),
        },
      ]),
    },
  ];

  open(departure: Departure | null): void {
    const ref = this.offcanvas.open(DepartureForm, {
      position: 'end',
      panelClass: 'aac-offcanvas-lg',
      backdrop: 'static',
      ariaLabelledBy: 'departure-form-title',
    });
    (ref.componentInstance as DepartureForm).departure = departure;
  }

  openDetail(d: Departure): void {
    void this.router.navigate(['/admin/departures', d.id]);
  }
}
