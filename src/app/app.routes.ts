import { Routes } from '@angular/router';
import { Home } from './features/home/home';

export const routes: Routes = [
  { path: '', component: Home },
  {
    path: 'tours',
    loadComponent: () => import('./features/tours/tours').then((m) => m.Tours),
  },
  {
    path: 'tours/:slug',
    loadComponent: () => import('./features/tour-detail/tour-detail').then((m) => m.TourDetail),
  },
  {
    path: 'book/:slug',
    loadComponent: () => import('./features/book/book').then((m) => m.Book),
  },
  {
    path: 'destinations',
    loadComponent: () => import('./features/destinations/destinations').then((m) => m.Destinations),
  },
  {
    path: 'destinations/:slug',
    loadComponent: () =>
      import('./features/destination-detail/destination-detail').then((m) => m.DestinationDetail),
  },
  {
    path: 'my-trips',
    loadComponent: () => import('./features/my-trips/my-trips').then((m) => m.MyTrips),
  },
  {
    path: 'my-trips/:ref',
    loadComponent: () => import('./features/my-trips/trip').then((m) => m.Trip),
  },
  { path: 'about', loadComponent: () => import('./features/about/about').then((m) => m.About) },
  {
    path: 'contact',
    loadComponent: () => import('./features/contact/contact').then((m) => m.Contact),
  },
  {
    path: 'admin',
    loadChildren: () => import('../admin/admin.routes').then((m) => m.ADMIN_ROUTES),
  },
  {
    path: 'coordinator',
    loadChildren: () =>
      import('../coordinator/coordinator.routes').then((m) => m.COORDINATOR_ROUTES),
  },
  { path: '**', loadComponent: () => import('./features/not-found').then((m) => m.NotFound) },
];
