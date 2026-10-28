import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, TemplateRef, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Meta } from '@angular/platform-browser';
import {
  ActivatedRoute,
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { NgbOffcanvas } from '@ng-bootstrap/ng-bootstrap';
import { filter, map } from 'rxjs';
import { ContentStore, DraftKind } from '../../app/core/services/content-store';
import { assetUrl } from '../../app/core/utils/url';
import { AdminAuthService } from '../core/admin-auth.service';
import { AdminDataService } from '../core/admin-data.service';
import { AdminAlerts } from '../core/alerts.service';

@Component({
  selector: 'app-admin-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NgTemplateOutlet],
  templateUrl: './admin-shell.html',
  styleUrl: './admin-shell.scss',
})
export class AdminShell {
  readonly auth = inject(AdminAuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly offcanvas = inject(NgbOffcanvas);
  private readonly alerts = inject(AdminAlerts);
  readonly store = inject(ContentStore);
  readonly assetUrl = assetUrl;

  readonly nav = [
    {
      group: 'Overview',
      items: [
        { path: 'dashboard', label: 'Dashboard', icon: '◔' },
        { path: 'reports', label: 'Reports', icon: '▤' },
      ],
    },
    {
      group: 'Sales',
      items: [
        { path: 'bookings', label: 'Bookings', icon: '✎' },
        { path: 'departures', label: 'Departures', icon: '▦' },
      ],
    },
    {
      group: 'Catalogue',
      items: [
        { path: 'tours', label: 'Tour packages', icon: '◆' },
        { path: 'destinations', label: 'Destinations', icon: '▲' },
        { path: 'coordinators', label: 'Coordinators', icon: '☺' },
      ],
    },
    {
      group: 'Settings',
      items: [
        { path: 'settings', label: 'Company settings', icon: '⚙' },
        { path: 'users', label: 'Admin users', icon: '⚿' },
        { path: 'publish', label: 'Publish', icon: '⇪' },
      ],
    },
  ];

  readonly heading = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.currentHeading()),
    ),
    { initialValue: this.currentHeading() },
  );

  constructor() {
    inject(Meta).updateTag({ name: 'robots', content: 'noindex' });

    const data = inject(AdminDataService);
    effect(() => {
      const settings = this.store.settings();
      if (this.store.state() === 'ready' && settings) {
        data.seedDemoBookings(this.store.tours(), this.store.departures(), settings);
      }
    });
  }

  private currentHeading(): string {
    let r = this.route.snapshot;
    while (r.firstChild) r = r.firstChild;
    return (r.data['heading'] as string | undefined) ?? 'Admin';
  }

  readonly draftLabels: Record<DraftKind, string> = {
    destinations: 'Destinations',
    tours: 'Tour packages',
    departures: 'Departures',
    coordinators: 'Coordinators',
    settings: 'Company settings',
  };

  async loadNewFile(kind: DraftKind): Promise<void> {
    const ok = await this.alerts.confirm(
      `Load the new ${this.draftLabels[kind].toLowerCase()} file?`,
      'Your unpublished changes here will be discarded.',
      'Yes, load it',
      'warning',
    );
    if (!ok) return;
    this.store.discardDraft(kind);
    void this.alerts.toast('New file loaded');
  }

  openMenu(content: TemplateRef<unknown>): void {
    this.offcanvas.open(content, { position: 'start', panelClass: 'aac-portal-menu' });
  }

  async lock(): Promise<void> {
    this.offcanvas.dismiss();
    if (
      !(await this.alerts.confirm(
        'Lock the admin portal?',
        'You will need the passcode to come back in.',
        'Lock',
      ))
    )
      return;
    this.auth.lock();
    void this.router.navigateByUrl('/admin/login');
  }
}
