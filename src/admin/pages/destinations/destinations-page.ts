import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NgbOffcanvas } from '@ng-bootstrap/ng-bootstrap';
import { AgGridAngular } from 'ag-grid-angular';
import { CellValueChangedEvent, ColDef } from 'ag-grid-community';
import { Destination } from '../../../app/core/models';
import { ContentStore } from '../../../app/core/services/content-store';
import { AdminAlerts } from '../../core/alerts.service';
import { actionButtons, adminGridTheme, pinRightOnWideScreens, thumbnail } from '../../shared/grid';
import { DestinationForm } from './destination-form';

@Component({
  selector: 'app-destinations-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AgGridAngular],
  template: `
    <div class="card border-0 shadow-sm">
      <div class="card-header bg-white d-flex flex-wrap align-items-center gap-2 py-3">
        <input
          type="search"
          class="form-control form-control-sm"
          style="max-width: 300px"
          placeholder="Search destinations"
          (input)="search.set($any($event.target).value)"
        />
        <button type="button" class="btn btn-sm btn-primary ms-auto" (click)="open(null)">
          + Add destination
        </button>
      </div>
      <ag-grid-angular
        style="display: block; height: calc(100vh - 230px); min-height: 420px"
        [theme]="theme"
        [rowData]="store.destinations()"
        [columnDefs]="columns"
        [defaultColDef]="{
          sortable: true,
          filter: true,
          resizable: true,
          suppressHeaderMenuButton: true,
        }"
        [getRowId]="getRowId"
        [quickFilterText]="search()"
        [rowHeight]="56"
        (cellValueChanged)="onToggle($event)"
      />
    </div>
    <p class="small text-body-secondary mt-2">
      Regions (no parent) appear on the home page when Featured is ticked. Places sit inside a
      region, e.g. Leh inside Ladakh.
    </p>
  `,
})
export class DestinationsPage {
  readonly store = inject(ContentStore);
  private readonly offcanvas = inject(NgbOffcanvas);
  private readonly alerts = inject(AdminAlerts);

  readonly theme = adminGridTheme;
  readonly search = signal('');
  readonly getRowId = (p: { data: Destination }) => p.data.id;

  private readonly names = computed(
    () => new Map(this.store.destinations().map((d) => [d.id, d.name])),
  );
  private readonly tourCounts = computed(() => {
    const counts = new Map<string, number>();
    for (const t of this.store.tours()) {
      for (const id of t.destinationIds) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return counts;
  });

  readonly columns: ColDef<Destination>[] = [
    {
      headerName: '',
      field: 'image',
      width: 70,
      sortable: false,
      filter: false,
      cellRenderer: thumbnail('round'),
    },
    { headerName: 'Name', field: 'name', flex: 1, minWidth: 160 },
    {
      headerName: 'Inside',
      colId: 'parent',
      width: 160,
      valueGetter: (p) => (p.data?.parentId ? this.names().get(p.data.parentId) : 'Region'),
    },
    { headerName: 'Best season', field: 'bestSeason', flex: 1, minWidth: 160 },
    {
      headerName: 'Tours',
      colId: 'tours',
      width: 95,
      valueGetter: (p) => this.tourCounts().get(p.data?.id ?? '') ?? 0,
    },
    { headerName: 'Order', field: 'displayOrder', width: 95 },
    {
      headerName: 'Featured',
      field: 'featured',
      width: 105,
      editable: true,
      cellDataType: 'boolean',
    },
    { headerName: 'Active', field: 'active', width: 95, editable: true, cellDataType: 'boolean' },
    {
      headerName: 'Actions',
      colId: 'actions',
      width: 150,
      sortable: false,
      filter: false,
      pinned: pinRightOnWideScreens(),
      cellRenderer: actionButtons<Destination>(
        (d) => this.open(d),
        (d) => void this.remove(d),
      ),
    },
  ];

  open(destination: Destination | null): void {
    const ref = this.offcanvas.open(DestinationForm, {
      position: 'end',
      panelClass: 'aac-offcanvas-lg',
      backdrop: 'static',
      ariaLabelledBy: 'destination-form-title',
    });
    (ref.componentInstance as DestinationForm).destination = destination;
  }

  onToggle(event: CellValueChangedEvent<Destination>): void {
    const field = event.colDef.field as 'featured' | 'active';
    this.store.saveDraft(
      'destinations',
      this.store
        .destinations()
        .map((d) => (d.id === event.data.id ? { ...d, [field]: !!event.newValue } : d)),
    );
    void this.alerts.toast(`${event.data.name} updated`);
  }

  async remove(d: Destination): Promise<void> {
    const tours = this.tourCounts().get(d.id) ?? 0;
    const children = this.store.destinations().filter((x) => x.parentId === d.id).length;
    if (children) {
      void this.alerts.error('Move its places first', `${children} places are inside ${d.name}.`);
      return;
    }
    const text = tours
      ? `${tours} tour(s) list this destination. They keep working but lose the link.`
      : 'It will be removed from the website.';
    if (!(await this.alerts.confirmDelete(`Delete ${d.name}?`, text))) return;
    this.store.saveDraft(
      'destinations',
      this.store.destinations().filter((x) => x.id !== d.id),
    );
    if (tours) {
      this.store.saveDraft(
        'tours',
        this.store
          .tours()
          .map((t) => ({ ...t, destinationIds: t.destinationIds.filter((id) => id !== d.id) })),
      );
    }
    void this.alerts.toast('Destination deleted');
  }
}
