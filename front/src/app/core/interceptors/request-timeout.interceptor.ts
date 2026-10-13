import {
  HttpContextToken,
  HttpErrorResponse,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { throwError, timeout } from 'rxjs';

/**
 * Délai maximum d'une requête, en millisecondes — refonte 2b, étape 14a.
 * 30 s par défaut ; `null` pour n'en mettre aucun.
 *
 *   http.get(url, { context: new HttpContext().set(REQUEST_TIMEOUT_MS, null) })
 */
export const REQUEST_TIMEOUT_MS = new HttpContextToken<number | null>(() => 30_000);

/**
 * Abandonne une requête qui dépasse son délai. L'erreur est une
 * `HttpErrorResponse` comme une autre, si bien qu'elle suit le chemin
 * d'erreur déjà en place : l'état d'erreur de 8c sur une liste (via
 * `describeLoadError`), le `error.message` affiché par les formulaires.
 *
 * Les envois de fichiers en sont exclus : un import Excel ou un logo sur une
 * ligne lente peut légitimement dépasser 30 s, et l'abandonner ferait perdre
 * tout le transfert.
 */
export const requestTimeoutInterceptor: HttpInterceptorFn = (req, next) => {
  const limitMs = isFileUpload(req) ? null : req.context.get(REQUEST_TIMEOUT_MS);

  if (limitMs === null) {
    return next(req);
  }

  // `each` et non `first` : le premier événement d'une requête est le
  // HttpSentEvent, émis dès l'envoi. `first` serait satisfait aussitôt et ne
  // limiterait plus rien. Avec `each`, c'est l'attente de la réponse qui est
  // bornée.
  return next(req).pipe(
    timeout({ each: limitMs, with: () => throwError(() => timeoutError(req, limitMs)) }),
  );
};

/** L'erreur produite par ce délai, et elle seule. */
export function isRequestTimeout(error: unknown): error is HttpErrorResponse {
  return error instanceof HttpErrorResponse && error.status === 0 && error.error?.timeout === true;
}

function isFileUpload(req: HttpRequest<unknown>): boolean {
  return req.body instanceof FormData || req.body instanceof Blob;
}

function timeoutError(req: HttpRequest<unknown>, limitMs: number): HttpErrorResponse {
  const seconds = Math.round(limitMs / 1000);
  const readOnly = req.method === 'GET' || req.method === 'HEAD';

  // C'est le navigateur qui abandonne, pas le serveur : PHP peut aller au
  // bout et valider l'écriture. Sur un paiement, « réessayer » sans le dire
  // en créerait un second.
  const message = readOnly
    ? `Le serveur n'a pas répondu en ${seconds} secondes.`
    : `Le serveur n'a pas répondu en ${seconds} secondes. L'opération a pu aboutir malgré tout : vérifiez avant de la relancer.`;

  return new HttpErrorResponse({
    status: 0,
    statusText: 'Délai dépassé',
    url: req.urlWithParams,
    error: { message, timeout: true },
  });
}
