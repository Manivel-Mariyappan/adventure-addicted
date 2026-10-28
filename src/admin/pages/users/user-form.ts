import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { NgbActiveOffcanvas } from '@ng-bootstrap/ng-bootstrap';
import { NgSelectComponent } from '@ng-select/ng-select';
import { assetUrl } from '../../../app/core/utils/url';
import { AdminDataService } from '../../core/admin-data.service';
import { AdminRole, AdminUser } from '../../core/admin-models';
import { AdminAlerts } from '../../core/alerts.service';
import { resizeToWebp } from '../../core/image-resize';
import { newId } from '../../core/local-collection';
import { NumbersOnlyDirective } from '../../core/numbers-only.directive';
import { AdminCard } from '../../shared/admin-card';

// Both fields may be empty when editing (keeps the current password).
function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const p = group.get('password')?.value as string;
  const c = group.get('confirmPassword')?.value as string;
  return p === c ? null : { mismatch: true };
}

@Component({
  selector: 'app-user-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, NgSelectComponent, NumbersOnlyDirective, AdminCard],
  templateUrl: './user-form.html',
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
    }
  `,
})
export class UserForm implements OnInit {
  private readonly data = inject(AdminDataService);
  private readonly fb = inject(FormBuilder);
  private readonly alerts = inject(AdminAlerts);
  readonly offcanvas = inject(NgbActiveOffcanvas);

  // null when adding a new user
  user: AdminUser | null = null;

  readonly roles: { value: AdminRole; label: string }[] = [
    { value: 'Owner', label: 'Owner: full access, including payments and settings' },
    { value: 'Operations', label: 'Operations: tours, departures and bookings' },
  ];
  readonly submitted = signal(false);
  // data URL from an upload, or a path
  readonly photo = signal('');
  readonly assetUrl = assetUrl;

  readonly form = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.maxLength(80)]],
    email: ['', Validators.email],
    mobile: ['', Validators.pattern(/^\d{10}$/)],
    username: ['', [Validators.required, Validators.pattern(/^[a-zA-Z0-9._]{3,30}$/)]],
    role: this.fb.nonNullable.control<AdminRole>('Operations'),
    passwords: this.fb.nonNullable.group(
      { password: [''], confirmPassword: [''] },
      { validators: passwordsMatch },
    ),
  });

  ngOnInit(): void {
    const u = this.user;
    const password = this.form.controls.passwords.controls.password;
    if (u) {
      this.form.patchValue(u);
      this.photo.set(u.photo ?? '');
      password.setValidators(Validators.minLength(8));
    } else {
      password.setValidators([Validators.required, Validators.minLength(8)]);
    }
    password.updateValueAndValidity();
  }

  async upload(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    if (file) this.photo.set(await resizeToWebp(file, 400));
    input.value = '';
  }

  invalid(name: 'fullName' | 'email' | 'mobile' | 'username'): boolean {
    const c = this.form.controls[name];
    return c.invalid && (c.touched || this.submitted());
  }

  passwordInvalid(): boolean {
    const c = this.form.controls.passwords.controls.password;
    return c.invalid && (c.touched || this.submitted());
  }

  mismatch(): boolean {
    const g = this.form.controls.passwords;
    return g.hasError('mismatch') && (g.controls.confirmPassword.touched || this.submitted());
  }

  async save(): Promise<void> {
    this.submitted.set(true);
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      void this.alerts.error(
        'Please check the form',
        'Some fields are missing or invalid. Please review the highlighted fields.',
      );
      return;
    }
    const { passwords: _passwords, ...v } = this.form.getRawValue();
    const username = v.username.toLowerCase();
    if (
      this.data.users
        .all()
        .some((u) => u.username.toLowerCase() === username && u.id !== this.user?.id)
    ) {
      void this.alerts.error(
        'Username already in use',
        `"${username}" is already used by another admin user.`,
      );
      return;
    }
    const admins = this.data.users
      .all()
      .filter((u) => u.role === 'Owner' && u.active && u.id !== this.user?.id);
    if (this.user?.role === 'Owner' && v.role !== 'Owner' && admins.length === 0) {
      void this.alerts.error(
        'Owner account required',
        'At least one active Owner account is required.',
      );
      return;
    }
    if (
      this.user &&
      !(await this.alerts.confirm('Update this user?', `${v.fullName} (${username})`))
    )
      return;
    const record: AdminUser = {
      id: this.user?.id ?? newId('usr'),
      ...v,
      username,
      photo: this.photo(),
      // made inactive or active again from the users list
      active: this.user?.active ?? true,
      lastLogin: this.user?.lastLogin ?? null,
      createdAt: this.user?.createdAt ?? new Date().toISOString(),
    };
    this.data.users.upsert(record);
    this.offcanvas.close(record);
    void this.alerts.success(
      this.user ? 'User updated' : 'User added',
      `${record.fullName} (${record.username})`,
    );
  }
}
