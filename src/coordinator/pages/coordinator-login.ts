import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ContentStore } from '../../app/core/services/content-store';
import { CoordinatorAuthService } from '../core/coordinator-auth.service';

@Component({
  selector: 'app-coordinator-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  template: `
    <div class="min-vh-100 d-flex align-items-center justify-content-center p-3 page">
      <form class="card shadow border-0 p-4" style="width: min(400px, 100%)" (ngSubmit)="submit()">
        <div class="d-flex align-items-center gap-2 mb-3">
          <img src="favicon.svg" alt="" width="36" height="36" />
          <span class="fw-bold">Adventure Addicted</span>
        </div>
        <h1 class="h4 fw-bold mb-1">Coordinator portal</h1>
        <p class="text-body-secondary small mb-4">Your trips, passengers and daily reports.</p>

        @if (error()) {
          <div class="alert alert-danger py-2" role="alert">{{ error() }}</div>
        }

        <label class="form-label" for="c-who">Your name</label>
        <select
          id="c-who"
          class="form-select form-select-lg mb-3"
          name="who"
          [(ngModel)]="who"
          required
        >
          <option value="" disabled>Choose your name</option>
          @for (c of coordinators(); track c.id) {
            <option [value]="c.id">{{ c.name }}</option>
          }
        </select>

        <label class="form-label" for="c-pin">PIN</label>
        <input
          id="c-pin"
          class="form-control form-control-lg mb-4"
          name="pin"
          type="password"
          inputmode="numeric"
          autocomplete="one-time-code"
          maxlength="6"
          [(ngModel)]="pin"
          placeholder="4 to 6 digits"
          required
        />

        <button type="submit" class="btn btn-primary btn-lg w-100" [disabled]="busy()">
          {{ busy() ? 'Checking...' : 'Sign in' }}
        </button>
        <p class="small text-body-secondary mt-3 mb-0">
          Forgot your PIN? Ask the office to set a new one.
        </p>
      </form>
    </div>
  `,
  styles: `
    .page {
      background: #0f1f3d url('/art/hero.svg') center / cover;
    }
  `,
})
export class CoordinatorLogin {
  private readonly auth = inject(CoordinatorAuthService);
  private readonly router = inject(Router);
  private readonly store = inject(ContentStore);

  readonly coordinators = computed(() => this.store.coordinators().filter((c) => c.active));
  readonly error = signal('');
  readonly busy = signal(false);
  who = '';
  pin = '';

  async submit(): Promise<void> {
    this.error.set('');
    if (!this.who || !this.pin) {
      this.error.set('Choose your name and enter your PIN.');
      return;
    }
    this.busy.set(true);
    const ok = await this.auth.login(this.who, this.pin);
    this.busy.set(false);
    if (!ok) {
      this.error.set('That PIN is not right.');
      return;
    }
    void this.router.navigateByUrl('/coordinator');
  }
}
