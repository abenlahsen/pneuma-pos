import { HttpContextToken, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

import { PendingRequestsService } from '../services/pending-requests.service';

/**
 * Requête de fond — un sondage que l'utilisateur n'a pas demandé. Elle
 * n'allume ni la barre haute ni le bandeau : un rafraîchissement périodique
 * qui fait défiler la barre toutes les 30 s finirait par ne plus rien dire,
 * et le bandeau « N'actualisez pas la page » alarmerait sans raison.
 *
 *   http.get(url, { context: new HttpContext().set(BACKGROUND_REQUEST, true) })
 */
export const BACKGROUND_REQUEST = new HttpContextToken<boolean>(() => false);

/** Refonte 2b, étape 14a — compte les requêtes en cours pour la barre haute. */
export const pendingRequestsInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.context.get(BACKGROUND_REQUEST)) {
    return next(req);
  }

  return inject(PendingRequestsService).track(next(req));
};
