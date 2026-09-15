import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';

/** Code renvoye par le middleware `password.changed` du backend. */
const PASSWORD_CHANGE_REQUIRED = 'PASSWORD_CHANGE_REQUIRED';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const token = localStorage.getItem('auth_token');

  const clonedReq = req.clone({
    setHeaders: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      Accept: 'application/json',
    },
  });

  return next(clonedReq).pipe(
    tap({
      error: (err) => {
        if (err.status === 401) {
          localStorage.removeItem('auth_token');
          router.navigate(['/login']);
          return;
        }
        if (err.status === 403 && err.error?.code === PASSWORD_CHANGE_REQUIRED) {
          router.navigate(['/change-password']);
        }
      },
    }),
  );
};
