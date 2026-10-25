import { Injectable, computed, inject, signal } from '@angular/core';
import { APP_CONFIG } from '../../app/core/config/app-config';
import { AdminDataService } from './admin-data.service';
import { sha256Hex } from './hash';

const SESSION_KEY = 'aac.admin.session';

// Usernames come from the Admin users screen. Until the Auth API exists, every account uses
// the password whose hash is in app-config.ts. This only keeps casual visitors out; it is not
// real security, since anyone can read the JavaScript.
@Injectable({ providedIn: 'root' })
export class AdminAuthService {
  private readonly data = inject(AdminDataService);

  readonly username = signal<string | null>(this.readSession());
  readonly unlocked = computed(() => this.username() !== null);
  readonly currentUser = computed(
    () => this.data.users.all().find((u) => u.username === this.username()) ?? null,
  );

  // Returns an error message, or null when the login worked.
  async login(username: string, password: string): Promise<string | null> {
    const name = username.trim().toLowerCase();
    const user = this.data.users.all().find((u) => u.username.toLowerCase() === name);
    const passwordOk = (await sha256Hex(password)) === APP_CONFIG.adminPasscodeSha256;
    if (!user || !passwordOk) return 'Incorrect username or password.';
    if (!user.active) return 'This account is disabled. Ask an admin to activate it.';
    this.data.users.upsert({ ...user, lastLogin: new Date().toISOString() });
    this.username.set(user.username);
    try {
      sessionStorage.setItem(SESSION_KEY, user.username);
    } catch {
      /* session-only login still works for this page view */
    }
    return null;
  }

  lock(): void {
    this.username.set(null);
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
  }

  private readSession(): string | null {
    try {
      return sessionStorage.getItem(SESSION_KEY);
    } catch {
      return null;
    }
  }
}
