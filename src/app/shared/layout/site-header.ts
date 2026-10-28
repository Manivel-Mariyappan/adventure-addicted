import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs';
import { ContentStore } from '../../core/services/content-store';
import { MyTripsService } from '../../core/services/my-trips.service';
import { Icon } from '../icons';

@Component({
  selector: 'app-site-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, Icon],
  templateUrl: './site-header.html',
  styleUrl: './site-header.scss',
  host: {
    '[class.scrolled]': 'scrolled()',
    '[class.menu-open]': 'menuOpen()',
    '(window:scroll)': 'onScroll()',
    '(document:keydown.escape)': 'menuOpen.set(false)',
  },
})
export class SiteHeader {
  private readonly myTrips = inject(MyTripsService);
  readonly logo = inject(ContentStore).logo;

  readonly menuOpen = signal(false);
  readonly scrolled = signal(false);
  readonly tripCount = computed(() => this.myTrips.trips().length);

  readonly links = [
    { path: '/tours', label: 'All tours', query: null },
    { path: '/tours', label: 'Bike expeditions', query: { travel: 'bike' } },
    { path: '/tours', label: 'Self-drive', query: { travel: 'own-car' } },
    { path: '/destinations', label: 'Destinations', query: null },
    { path: '/about', label: 'About', query: null },
    { path: '/contact', label: 'Contact', query: null },
  ];

  constructor() {
    inject(Router)
      .events.pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.menuOpen.set(false));
  }

  onScroll(): void {
    this.scrolled.set(window.scrollY > 8);
  }
}
