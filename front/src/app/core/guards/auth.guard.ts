import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = async (route) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated() && !authService.getToken()) {
    return router.createUrlTree(['/login']);
  }

  // Wait for user data to be loaded (handles page refresh)
  await authService.whenReady();

  // If user must change password, only allow the change-password route
  if (authService.mustChangePassword()) {
    const targetPath = route.routeConfig?.path;
    if (targetPath !== 'change-password') {
      return router.createUrlTree(['/change-password']);
    }
  }

  return true;
};

export const guestGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated() && !authService.getToken()) {
    return true;
  }

  return router.createUrlTree(['/dashboard']);
};
