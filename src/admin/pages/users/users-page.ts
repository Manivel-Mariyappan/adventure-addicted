import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NgbOffcanvas } from '@ng-bootstrap/ng-bootstrap';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef } from 'ag-grid-community';
import { AdminDataService } from '../../core/admin-data.service';
import { AdminUser } from '../../core/admin-models';
import { AdminAlerts } from '../../core/alerts.service';
import {
  actionButtons,
  adminGridTheme,
  badge,
  formatDateTime,
  pinRightOnWideScreens,
} from '../../shared/grid';
import { UiOnlyNote } from '../../shared/ui-only-note';
import { UserForm } from './user-form';

@Component({
  selector: 'app-users-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AgGridAngular, UiOnlyNote],
  templateUrl: './users-page.html',
})
export class UsersPage {
  readonly data = inject(AdminDataService);
  private readonly offcanvas = inject(NgbOffcanvas);
  private readonly alerts = inject(AdminAlerts);

  readonly theme = adminGridTheme;
  readonly search = signal('');
  readonly getRowId = (p: { data: AdminUser }) => p.data.id;

  readonly columns: ColDef<AdminUser>[] = [
    { headerName: 'Full name', field: 'fullName', flex: 1.4, minWidth: 180 },
    { headerName: 'Username', field: 'username', width: 150 },
    { headerName: 'Email', field: 'email', flex: 1.2, minWidth: 180 },
    { headerName: 'Mobile', field: 'mobile', width: 130 },
    {
      headerName: 'Role',
      field: 'role',
      width: 110,
      cellRenderer: badge({ Owner: 'warning', Operations: 'info' }),
    },
    { headerName: 'Active', field: 'active', width: 95, cellDataType: 'boolean' },
    {
      headerName: 'Last login',
      field: 'lastLogin',
      width: 190,
      valueFormatter: (p) => formatDateTime(p.value as string) || 'Never',
    },
    {
      headerName: 'Actions',
      colId: 'actions',
      width: 150,
      sortable: false,
      filter: false,
      pinned: pinRightOnWideScreens(),
      cellRenderer: actionButtons<AdminUser>(
        (u) => this.open(u),
        (u) => void this.remove(u),
      ),
    },
  ];

  open(user: AdminUser | null): void {
    const ref = this.offcanvas.open(UserForm, {
      position: 'end',
      panelClass: 'aac-offcanvas-lg',
      backdrop: 'static',
      ariaLabelledBy: 'user-form-title',
    });
    (ref.componentInstance as UserForm).user = user;
  }

  async remove(u: AdminUser): Promise<void> {
    const otherAdmins = this.data.users
      .all()
      .filter((x) => x.role === 'Owner' && x.active && x.id !== u.id);
    if (u.role === 'Owner' && otherAdmins.length === 0) {
      void this.alerts.error('Cannot delete', 'At least one active Owner account is required.');
      return;
    }
    if (
      !(await this.alerts.confirmDelete(
        `Delete ${u.fullName}?`,
        `The account "${u.username}" will no longer be able to log in.`,
      ))
    )
      return;
    this.data.users.remove(u.id);
    void this.alerts.toast('User deleted');
  }
}
