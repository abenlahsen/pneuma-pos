import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const permissionGuard: CanActivateFn = async (route) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Wait for user + permissions to be loaded (handles page refresh)
  await authService.whenReady();

  const requiredPermission = route.data?.['permission'] as string;

  if (!requiredPermission) {
    return true;
  }

  if (authService.hasPermission(requiredPermission)) {
    return true;
  }

  return router.createUrlTree(['/dashboard']);
};
