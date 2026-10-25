import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NgbOffcanvas } from '@ng-bootstrap/ng-bootstrap';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef } from 'ag-grid-community';
import { Coordinator } from '../../../app/core/models';
import { ContentStore } from '../../../app/core/services/content-store';
import { todayIso } from '../../../app/core/utils/dates';
import { AdminAlerts } from '../../core/alerts.service';
import { actionButtons, adminGridTheme, pinRightOnWideScreens } from '../../shared/grid';
import { CoordinatorForm } from './coordinator-form';

@Component({
  selector: 'app-coordinators-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AgGridAngular],
  template: `
    <div class="card border-0 shadow-sm">
      <div class="card-header bg-white d-flex flex-wrap align-items-center gap-2 py-3">
        <span class="small text-body-secondary">
          Coordinators sign in at <code>/coordinator</code> with their PIN.
        </span>
        <button type="button" class="btn btn-sm btn-primary ms-auto" (click)="open(null)">
          + Add coordinator
        </button>
      </div>
      <ag-grid-angular
        style="display: block; height: calc(100vh - 230px); min-height: 360px"
        [theme]="theme"
        [rowData]="store.coordinators()"
        [columnDefs]="columns"
        [defaultColDef]="{ sortable: true, resizable: true, suppressHeaderMenuButton: true }"
        [getRowId]="getRowId"
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
    { headerName: 'Name', field: 'name', flex: 1, minWidth: 170 },
    { headerName: 'Phone', field: 'phone', width: 160 },
    {
      headerName: 'Languages',
      colId: 'languages',
      flex: 1,
      minWidth: 160,
      valueGetter: (p) => p.data?.languages.join(', '),
    },
    {
      headerName: 'Experience',
      field: 'experienceYears',
      width: 125,
      valueFormatter: (p) => `${p.value} yrs`,
    },
    {
      headerName: 'Upcoming trips',
      colId: 'trips',
      width: 145,
      valueGetter: (p) => this.upcoming().get(p.data?.id ?? '') ?? 0,
    },
    { headerName: 'Active', field: 'active', width: 95, cellDataType: 'boolean' },
    {
      headerName: 'Actions',
      colId: 'actions',
      width: 150,
      sortable: false,
      pinned: pinRightOnWideScreens(),
      cellRenderer: actionButtons<Coordinator>(
        (c) => this.open(c),
        (c) => void this.remove(c),
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
    const text = trips
      ? `${c.name} leads ${trips} upcoming departure(s). They will have no coordinator until you assign one.`
      : 'This cannot be undone after you publish.';
    if (!(await this.alerts.confirmDelete(`Delete ${c.name}?`, text))) return;
    this.store.saveDraft(
      'coordinators',
      this.store.coordinators().filter((x) => x.id !== c.id),
    );
    if (trips) {
      this.store.saveDraft(
        'departures',
        this.store
          .departures()
          .map((d) => (d.coordinatorId === c.id ? { ...d, coordinatorId: null } : d)),
      );
    }
    void this.alerts.toast('Coordinator deleted');
  }
}
