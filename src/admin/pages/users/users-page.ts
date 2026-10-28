import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NgbOffcanvas } from '@ng-bootstrap/ng-bootstrap';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, ICellRendererParams } from 'ag-grid-community';
import { AdminAuthService } from '../../core/admin-auth.service';
import { AdminDataService } from '../../core/admin-data.service';
import { AdminUser } from '../../core/admin-models';
import { AdminAlerts } from '../../core/alerts.service';
import {
  adminGridTheme,
  badge,
  nameWithPhoto,
  pinRightOnWideScreens,
  rowButtons,
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
  private readonly auth = inject(AdminAuthService);

  readonly theme = adminGridTheme;
  readonly search = signal('');
  readonly getRowId = (p: { data: AdminUser }) => p.data.id;
  readonly isInactive = (p: { data?: AdminUser }) => !!p.data && !p.data.active;

  // inactive users stay in the list (hidden unless Show all is on), so they can be activated again
  readonly showAll = signal(false);
  readonly rows = computed(() => {
    const term = this.search().trim().toLowerCase();
    // mobile numbers are stored as digits, so "98765 43210" should still match
    const digits = term.replace(/\D/g, '');
    return this.data.users
      .all()
      .filter(
        (u) =>
          (this.showAll() || u.active) &&
          (!term ||
            u.fullName.toLowerCase().includes(term) ||
            u.username.toLowerCase().includes(term) ||
            u.email.toLowerCase().includes(term) ||
            (!!digits && u.mobile.includes(digits))),
      );
  });

  readonly columns: ColDef<AdminUser>[] = [
    {
      headerName: 'Full name',
      field: 'fullName',
      flex: 1.4,
      minWidth: 200,
      cellRenderer: (p: ICellRendererParams<AdminUser>) =>
        p.data ? nameWithPhoto(p.data.fullName, p.data.photo) : '',
    },
    { headerName: 'Username', field: 'username', width: 140 },
    { headerName: 'Email', field: 'email', flex: 1.2, minWidth: 180 },
    { headerName: 'Mobile', field: 'mobile', width: 125 },
    {
      headerName: 'Role',
      field: 'role',
      width: 110,
      cellRenderer: badge({ Owner: 'warning', Operations: 'info' }),
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
      filter: false,
      pinned: pinRightOnWideScreens(),
      // inactive users can only be activated, not edited
      cellRenderer: rowButtons<AdminUser>((u) =>
        u.active
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
    if (u.username === this.auth.currentUser()?.username) {
      void this.alerts.error(
        'Unable to delete',
        'You cannot delete the account you are signed in with.',
      );
      return;
    }
    const otherAdmins = this.data.users
      .all()
      .filter((x) => x.role === 'Owner' && x.active && x.id !== u.id);
    if (u.role === 'Owner' && otherAdmins.length === 0) {
      void this.alerts.error('Unable to delete', 'At least one active Owner account is required.');
      return;
    }
    if (
      !(await this.alerts.confirmDelete(
        `Delete ${u.fullName}?`,
        `The account "${u.username}" will no longer be able to sign in. You can activate it again from Show all.`,
      ))
    )
      return;
    this.data.users.upsert({ ...u, active: false });
    void this.alerts.toast('User deleted');
  }

  async activate(u: AdminUser): Promise<void> {
    const ok = await this.alerts.confirm(
      `Activate ${u.fullName}?`,
      `The account "${u.username}" will be able to sign in to the admin portal again.`,
      'Yes, activate',
    );
    if (!ok) return;
    this.data.users.upsert({ ...u, active: true });
    void this.alerts.toast('User activated');
  }
}
