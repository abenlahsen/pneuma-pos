import { HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { switchMap, timer } from 'rxjs';

const DELAY_KEY = 'dev_api_delay_ms';
const MATCH_KEY = 'dev_api_delay_match';

/**
 * Développement seulement — simule une API lente pour voir les états
 * d'attente de l'étape 14. Branché dans `app.config.ts` hors production.
 * Réglage depuis la console du navigateur, sans recompiler :
 *
 *   localStorage.setItem('dev_api_delay_ms', '10000')    // 10 s par requête
 *   localStorage.setItem('dev_api_delay_match', '/sales') // facultatif : ces adresses seulement
 *   localStorage.removeItem('dev_api_delay_ms')           // retour à la normale
 *
 * Placé après le suivi et le délai maximum : la barre haute, le bandeau et
 * l'abandon à 30 s voient l'attente simulée comme une vraie.
 */
export const devLatencyInterceptor: HttpInterceptorFn = (req, next) => {
  const delayMs = configuredDelay(req);

  return delayMs > 0 ? timer(delayMs).pipe(switchMap(() => next(req))) : next(req);
};

function configuredDelay(req: HttpRequest<unknown>): number {
  try {
    const delayMs = Number(localStorage.getItem(DELAY_KEY));
    const match = localStorage.getItem(MATCH_KEY);

    if (!Number.isFinite(delayMs) || delayMs <= 0) return 0;
    if (match && !req.url.includes(match)) return 0;

    return delayMs;
  } catch {
    return 0;
  }
}
