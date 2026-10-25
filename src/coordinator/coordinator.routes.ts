import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { provideSweetAlert2 } from '@sweetalert2/ngx-sweetalert2';
import { adminStylesGuard } from '../admin/core/admin-styles';
import { AdminAlerts } from '../admin/core/alerts.service';
import { CoordinatorAuthService } from './core/coordinator-auth.service';

const signedIn: CanActivateFn = () =>
  inject(CoordinatorAuthService).signedIn() || inject(Router).createUrlTree(['/coordinator/login']);

// Lazy-loaded like the admin, and styled with the same Bootstrap bundle.
export const COORDINATOR_ROUTES: Routes = [
  {
    path: '',
    canActivate: [adminStylesGuard],
    providers: [provideSweetAlert2(), AdminAlerts],
    children: [
      {
        path: 'login',
        loadComponent: () => import('./pages/coordinator-login').then((m) => m.CoordinatorLogin),
        title: 'Coordinator sign in | Adventure Addicted',
      },
      {
        path: '',
        canActivate: [signedIn],
        loadComponent: () => import('./pages/coordinator-shell').then((m) => m.CoordinatorShell),
        children: [
          {
            path: '',
            loadComponent: () => import('./pages/my-departures').then((m) => m.MyDepartures),
            title: 'My trips | Coordinator',
          },
          {
            path: 'trips/:id',
            loadComponent: () => import('./pages/trip-workspace').then((m) => m.TripWorkspace),
            title: 'Trip | Coordinator',
          },
        ],
      },
    ],
  },
];
