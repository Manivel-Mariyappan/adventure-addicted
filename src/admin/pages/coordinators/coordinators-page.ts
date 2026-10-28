import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NgbOffcanvas } from '@ng-bootstrap/ng-bootstrap';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, ICellRendererParams } from 'ag-grid-community';
import { Coordinator } from '../../../app/core/models';
import { ContentStore } from '../../../app/core/services/content-store';
import { todayIso } from '../../../app/core/utils/dates';
import { AdminAlerts } from '../../core/alerts.service';
import {
  adminGridTheme,
  badge,
  nameWithPhoto,
  pinRightOnWideScreens,
  rowButtons,
} from '../../shared/grid';
import { CoordinatorForm } from './coordinator-form';

@Component({
  selector: 'app-coordinators-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AgGridAngular],
  template: `
    <div class="card border-0 shadow-sm">
      <div class="card-header bg-white d-flex flex-wrap align-items-center gap-3 py-3">
        <input
          type="search"
          class="form-control form-control-sm"
          style="max-width: 300px"
          placeholder="Search by name, email or phone"
          aria-label="Search coordinators"
          (input)="search.set($any($event.target).value)"
        />
        <div class="form-check form-switch mb-0">
          <input
            class="form-check-input"
            type="checkbox"
            role="switch"
            id="crd-show-all"
            [checked]="showAll()"
            (change)="showAll.set(!showAll())"
          />
          <label class="form-check-label small" for="crd-show-all">
            Show all, including inactive
          </label>
        </div>
        <button type="button" class="btn btn-sm btn-primary ms-auto" (click)="open(null)">
          + Add coordinator
        </button>
      </div>
      <ag-grid-angular
        style="display: block; height: calc(100vh - 230px); min-height: 360px"
        [theme]="theme"
        [rowData]="rows()"
        [columnDefs]="columns"
        [defaultColDef]="{ sortable: true, resizable: true, suppressHeaderMenuButton: true }"
        [getRowId]="getRowId"
        [rowClassRules]="{ 'row-deleted': isDeleted }"
        [rowHeight]="52"
      />
    </div>
  `,
})
export class CoordinatorsPage {
  readonly store = inject(ContentStore);
  private readonly offcanvas = inject(NgbOffcanvas);
  private readonly alerts = inject(AdminAlerts);

  readonly theme = adminGridTheme;
  readonly getRowId = (p: { data: Coordinator }) => p.data.id;
  readonly isDeleted = (p: { data?: Coordinator }) => !!p.data && !p.data.active;

  // deleted coordinators stay in the data as inactive, so past trips keep their name
  readonly showAll = signal(false);
  readonly search = signal('');
  readonly rows = computed(() => {
    const term = this.search().trim().toLowerCase();
    // phone numbers are stored as digits, so "98765 43210" should still match
    const digits = term.replace(/\D/g, '');
    return this.store
      .coordinators()
      .filter(
        (c) =>
          (this.showAll() || c.active) &&
          (!term ||
            c.name.toLowerCase().includes(term) ||
            (c.email ?? '').toLowerCase().includes(term) ||
            (!!digits && c.phone.replace(/\D/g, '').includes(digits))),
      );
  });

  private readonly upcoming = computed(() => {
    const counts = new Map<string, number>();
    const today = todayIso();
    for (const d of this.store.departures()) {
      if (d.coordinatorId && d.status === 'scheduled' && d.endDate >= today) {
        counts.set(d.coordinatorId, (counts.get(d.coordinatorId) ?? 0) + 1);
      }
    }
    return counts;
  });

  readonly columns: ColDef<Coordinator>[] = [
    {
      headerName: 'Name',
      field: 'name',
      flex: 1,
      minWidth: 215,
      cellRenderer: (p: ICellRendererParams<Coordinator>) =>
        p.data ? nameWithPhoto(p.data.name, p.data.photo) : '',
    },
    { headerName: 'Gender', field: 'gender', width: 100 },
    { headerName: 'Email', field: 'email', flex: 1, minWidth: 180 },
    { headerName: 'Phone', field: 'phone', width: 125 },
    {
      headerName: 'Languages',
      colId: 'languages',
      flex: 1,
      minWidth: 140,
      valueGetter: (p) => p.data?.languages.join(', '),
    },
    {
      headerName: 'Experience',
      field: 'experienceYears',
      width: 115,
      valueFormatter: (p) => `${p.value} yrs`,
    },
    {
      headerName: 'Upcoming',
      colId: 'trips',
      width: 110,
      valueGetter: (p) => this.upcoming().get(p.data?.id ?? '') ?? 0,
    },
    {
      headerName: 'Status',
      colId: 'status',
      width: 100,
      valueGetter: (p) => (p.data?.active ? 'Active' : 'Inactive'),
      cellRenderer: badge({ Active: 'success', Inactive: 'danger' }),
    },
    {
      headerName: 'Actions',
      colId: 'actions',
      width: 165,
      sortable: false,
      pinned: pinRightOnWideScreens(),
      // deleted coordinators can only be activated, not edited
      cellRenderer: rowButtons<Coordinator>((c) =>
        c.active
          ? [
              { label: 'Edit', className: 'btn-outline-primary', onClick: (x) => this.open(x) },
              {
                label: 'Delete',
                className: 'btn-outline-danger',
                onClick: (x) => void this.remove(x),
              },
            ]
          : [
              {
                label: 'Activate',
                className: 'btn-outline-success',
                onClick: (x) => void this.activate(x),
              },
            ],
      ),
    },
  ];

  open(coordinator: Coordinator | null): void {
    const ref = this.offcanvas.open(CoordinatorForm, {
      position: 'end',
      panelClass: 'aac-offcanvas-lg',
      backdrop: 'static',
      ariaLabelledBy: 'coordinator-form-title',
    });
    (ref.componentInstance as CoordinatorForm).coordinator = coordinator;
  }

  async remove(c: Coordinator): Promise<void> {
    const trips = this.upcoming().get(c.id) ?? 0;
    const text =
      'They will no longer be able to sign in to the coordinator portal or appear on the website. ' +
      (trips
        ? `They lead ${trips} upcoming departure(s), which will have no coordinator until you assign one. `
        : '') +
      'You can activate them again from Show all.';
    if (!(await this.alerts.confirmDelete(`Delete ${c.name}?`, text))) return;
    this.setActive(c, false);
    if (trips) {
      // only upcoming trips lose their coordinator; past trips keep them for reports
      const today = todayIso();
      this.store.saveDraft(
        'departures',
        this.store
          .departures()
          .map((d) =>
            d.coordinatorId === c.id && d.status === 'scheduled' && d.endDate >= today
              ? { ...d, coordinatorId: null }
              : d,
          ),
      );
    }
    void this.alerts.toast('Coordinator deleted');
  }

  async activate(c: Coordinator): Promise<void> {
    const ok = await this.alerts.confirm(
      `Activate ${c.name}?`,
      'They will be able to sign in to the coordinator portal, appear on the website and be assigned to departures again.',
      'Yes, activate',
    );
    if (!ok) return;
    this.setActive(c, true);
    void this.alerts.toast('Coordinator activated');
  }

  private setActive(c: Coordinator, active: boolean): void {
    this.store.saveDraft(
      'coordinators',
      this.store.coordinators().map((x) => (x.id === c.id ? { ...x, active } : x)),
    );
  }
}
