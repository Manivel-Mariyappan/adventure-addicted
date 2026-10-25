import { Routes } from '@angular/router';
import { NgbDateParserFormatter, NgbOffcanvas } from '@ng-bootstrap/ng-bootstrap';
import { provideSweetAlert2 } from '@sweetalert2/ngx-sweetalert2';
import { adminStylesGuard } from './core/admin-styles';
import { adminGuard } from './core/admin.guard';
import { AdminAlerts } from './core/alerts.service';
import { DmyDateFormatter } from './core/date-formatter';

const page = (heading: string) => ({ title: `${heading} | Admin`, data: { heading } });

// Lazy-loaded from app.routes.ts, so website visitors never download any of this.
export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    canActivate: [adminStylesGuard],
    // NgbOffcanvas is provided again here so the offcanvas forms can inject AdminAlerts
    providers: [
      provideSweetAlert2(),
      AdminAlerts,
      NgbOffcanvas,
      { provide: NgbDateParserFormatter, useClass: DmyDateFormatter },
    ],
    children: [
      {
        path: 'login',
        loadComponent: () => import('./pages/login/login').then((m) => m.LoginPage),
        title: 'Admin login | Adventure Addicted',
      },
      {
        path: '',
        canActivate: [adminGuard],
        loadComponent: () => import('./layout/admin-shell').then((m) => m.AdminShell),
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
          {
            path: 'dashboard',
            loadComponent: () =>
              import('./pages/dashboard/dashboard-page').then((m) => m.DashboardPage),
            ...page('Dashboard'),
          },
          {
            path: 'bookings',
            loadComponent: () =>
              import('./pages/bookings/bookings-page').then((m) => m.BookingsPage),
            ...page('Bookings'),
          },
          {
            path: 'departures',
            loadComponent: () =>
              import('./pages/departures/departures-page').then((m) => m.DeparturesPage),
            ...page('Departures'),
          },
          {
            path: 'departures/:id',
            loadComponent: () =>
              import('./pages/departures/departure-detail').then((m) => m.DepartureDetail),
            ...page('Departure'),
          },
          {
            path: 'tours',
            loadComponent: () => import('./pages/tours/tours-page').then((m) => m.ToursPage),
            ...page('Tour packages'),
          },
          {
            path: 'tours/:id',
            loadComponent: () => import('./pages/tours/tour-editor').then((m) => m.TourEditor),
            ...page('Tour package'),
          },
          {
            path: 'destinations',
            loadComponent: () =>
              import('./pages/destinations/destinations-page').then((m) => m.DestinationsPage),
            ...page('Destinations'),
          },
          {
            path: 'coordinators',
            loadComponent: () =>
              import('./pages/coordinators/coordinators-page').then((m) => m.CoordinatorsPage),
            ...page('Coordinators'),
          },
          {
            path: 'reports',
            loadComponent: () => import('./pages/reports/reports-page').then((m) => m.ReportsPage),
            ...page('Reports'),
          },
          {
            path: 'settings',
            loadComponent: () =>
              import('./pages/settings/settings-page').then((m) => m.SettingsPage),
            ...page('Company settings'),
          },
          {
            path: 'users',
            loadComponent: () => import('./pages/users/users-page').then((m) => m.UsersPage),
            ...page('Admin users'),
          },
          {
            path: 'publish',
            loadComponent: () => import('./pages/publish/publish-page').then((m) => m.PublishPage),
            ...page('Publish'),
          },
        ],
      },
    ],
  },
];
