import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { ContentStore } from '../../app/core/services/content-store';
import { CoordinatorAuthService } from '../core/coordinator-auth.service';

@Component({
  selector: 'app-coordinator-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink],
  template: `
    <header class="bar">
      <a routerLink="/coordinator" class="brand">
        <img src="favicon.svg" alt="" width="30" height="30" />
        <span>Trips</span>
      </a>
      @if (auth.coordinator(); as c) {
        <span class="who">{{ c.name }}</span>
      }
      <button type="button" class="btn btn-sm btn-outline-light ms-auto" (click)="logout()">
        Sign out
      </button>
    </header>
    <main class="container-fluid py-3" style="max-width: 900px">
      @switch (store.state()) {
        @case ('loading') {
          <div class="text-secondary">
            <span class="spinner-border spinner-border-sm"></span> Loading...
          </div>
        }
        @case ('error') {
          <div class="alert alert-danger">
            Couldn't load the trip data. Check your connection and reload.
          </div>
        }
        @default {
          <router-outlet />
        }
      }
    </main>
  `,
  styles: `
    :host {
      display: block;
      min-height: 100vh;
      background: #f4f6fa;
    }
    .bar {
      position: sticky;
      top: 0;
      z-index: 10;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.6rem 1rem;
      color: #fff;
      background: #0f1f3d;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-weight: 700;
      color: #fff;
      text-decoration: none;
    }
    .who {
      font-size: 0.85rem;
      color: #cbd5e1;
    }
  `,
})
export class CoordinatorShell {
  readonly auth = inject(CoordinatorAuthService);
  readonly store = inject(ContentStore);
  private readonly router = inject(Router);

  constructor() {
    inject(Meta).updateTag({ name: 'robots', content: 'noindex' });
  }

  logout(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/coordinator/login');
  }
}
