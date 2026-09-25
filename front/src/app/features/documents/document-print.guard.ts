import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { DOCUMENT_PERMISSIONS, isDocumentType } from './document-types';

/**
 * `/documents/:type/:id/print` sert trois modules : la permission dépend du
 * segment `:type`, ce que `permissionGuard` (une permission fixe dans `data`)
 * ne sait pas exprimer. Un type inconnu renvoie au tableau de bord.
 */
export const documentPrintGuard: CanActivateFn = async (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  await auth.whenReady();

  const type = route.paramMap.get('type');
  if (isDocumentType(type) && auth.hasPermission(DOCUMENT_PERMISSIONS[type])) {
    return true;
  }
  return router.createUrlTree(['/dashboard']);
};
