import { Injectable, computed, inject, signal } from '@angular/core';
import { ContentStore } from '../../app/core/services/content-store';
import { sha256Hex } from '../../admin/core/hash';

const SESSION_KEY = 'aac.coordinator.session';

// PIN sign-in for coordinators. Like the admin password, the PIN hash is in a public file, so
// this only keeps casual visitors out. The passenger list itself never touches the website: it
// comes from the trip pack file the office sends.
@Injectable({ providedIn: 'root' })
export class CoordinatorAuthService {
  private readonly store = inject(ContentStore);

  readonly coordinatorId = signal<string | null>(read());
  readonly coordinator = computed(() =>
    this.store.coordinators().find((c) => c.id === this.coordinatorId() && c.active),
  );
  readonly signedIn = computed(() => this.coordinatorId() !== null);

  async login(coordinatorId: string, pin: string): Promise<boolean> {
    const c = this.store.coordinators().find((x) => x.id === coordinatorId && x.active);
    if (!c || !c.pinHash || (await sha256Hex(pin)) !== c.pinHash) return false;
    this.coordinatorId.set(c.id);
    try {
      sessionStorage.setItem(SESSION_KEY, c.id);
    } catch {
      // session-only sign-in still works for this page view
    }
    return true;
  }

  logout(): void {
    this.coordinatorId.set(null);
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      // nothing to clear
    }
  }
}

function read(): string | null {
  try {
    return sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}
