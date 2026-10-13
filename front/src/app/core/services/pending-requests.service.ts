import { Injectable, computed, signal } from '@angular/core';
import { Observable, defer, finalize } from 'rxjs';

/** En deçà, rien ne s'affiche : l'indicateur clignoterait sur chaque requête rapide. */
const BUSY_AFTER_MS = 300;

/** Au-delà, le bandeau « Toujours en cours… » s'ajoute à la barre haute. */
const SLOW_AFTER_MS = 8_000;

/**
 * Requêtes HTTP en cours — refonte 2b, étape 14a (maquette 21a, encadré 4).
 *
 * Alimenté par `pendingRequestsInterceptor` : c'est la seule source de la
 * barre haute et du bandeau, qui répondent à toute requête, y compris celles
 * qu'aucun bouton n'a lancées (chargement de page, recalcul).
 *
 * Chaque requête est mesurée depuis son propre départ. Un compteur global
 * démarré à la première requête allumerait la barre sur une rafale de
 * requêtes courtes enchaînées, alors qu'aucune n'a duré.
 */
@Injectable({ providedIn: 'root' })
export class PendingRequestsService {
  /** Requêtes en vol depuis plus de 300 ms. */
  private readonly busyRequests = signal(0);

  /** Requêtes en vol depuis plus de 8 s. */
  private readonly slowRequests = signal(0);

  /** Au moins une requête dure depuis plus de 300 ms. */
  readonly busy = computed(() => this.busyRequests() > 0);

  /** Au moins une requête dure depuis plus de 8 s. */
  readonly slow = computed(() => this.slowRequests() > 0);

  /**
   * Suit `source` le temps de son exécution. La fin compte aussi bien une
   * réponse qu'une erreur ou un abandon — `LatestRequest` désabonne la
   * requête qu'il remplace, et celle-ci ne doit pas rester allumée.
   */
  track<T>(source: Observable<T>): Observable<T> {
    return defer(() => source.pipe(finalize(this.start())));
  }

  /** Arme les deux seuils d'une requête ; renvoie de quoi la clore. */
  private start(): () => void {
    let busy = false;
    let slow = false;

    const busyTimer = setTimeout(() => {
      busy = true;
      this.busyRequests.update((n) => n + 1);
    }, BUSY_AFTER_MS);

    const slowTimer = setTimeout(() => {
      slow = true;
      this.slowRequests.update((n) => n + 1);
    }, SLOW_AFTER_MS);

    return () => {
      clearTimeout(busyTimer);
      clearTimeout(slowTimer);
      if (busy) this.busyRequests.update((n) => n - 1);
      if (slow) this.slowRequests.update((n) => n - 1);
    };
  }
}
