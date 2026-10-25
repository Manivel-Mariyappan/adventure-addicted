import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AdminAuthService } from './admin-auth.service';

export const adminGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AdminAuthService);
  return (
    auth.unlocked() ||
    inject(Router).createUrlTree(['/admin/login'], { queryParams: { next: state.url } })
  );
};
