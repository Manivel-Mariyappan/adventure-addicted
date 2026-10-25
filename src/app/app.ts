import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { ContentStore } from './core/services/content-store';
import { SeoService } from './core/services/seo.service';
import { SiteFooter } from './shared/layout/site-footer';
import { SiteHeader } from './shared/layout/site-header';
import { WhatsappFab } from './shared/layout/whatsapp-fab';

const isPortal = (url: string) => /^\/(admin|coordinator)(\/|$|\?)/.test(url);

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, SiteHeader, SiteFooter, WhatsappFab],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  readonly store = inject(ContentStore);
  // the admin and coordinator portals have their own layout
  readonly portal = signal(isPortal(location.pathname));

  constructor() {
    const router = inject(Router);
    const seo = inject(SeoService);
    const doc = inject(DOCUMENT);

    router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((e) => {
        this.portal.set(isPortal(e.urlAfterRedirects));
        // drop the portals' Bootstrap CSS again (see admin/core/admin-styles.ts)
        if (!this.portal()) {
          doc.documentElement.classList.remove('aac-portal');
          doc.getElementById('aac-portal-css')?.remove();
        }
      });

    effect(() => {
      const settings = this.store.settings();
      if (settings) seo.setBusiness(settings);
    });
  }
}
