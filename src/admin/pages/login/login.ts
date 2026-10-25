import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Meta } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { AdminAuthService } from '../../core/admin-auth.service';

@Component({
  selector: 'app-admin-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class LoginPage {
  private readonly auth = inject(AdminAuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  readonly next = input<string>();
  readonly error = signal('');
  readonly busy = signal(false);
  readonly submitted = signal(false);
  readonly showPassword = signal(false);

  readonly form = this.fb.nonNullable.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
  });

  constructor() {
    inject(Meta).updateTag({ name: 'robots', content: 'noindex' });
  }

  async submit(): Promise<void> {
    this.submitted.set(true);
    this.error.set('');
    if (this.form.invalid) return;
    this.busy.set(true);
    const { username, password } = this.form.getRawValue();
    const error = await this.auth.login(username, password);
    this.busy.set(false);
    if (error) {
      this.error.set(error);
      return;
    }
    const target = this.next()?.startsWith('/admin') ? this.next()! : '/admin';
    void this.router.navigateByUrl(target);
  }
}
