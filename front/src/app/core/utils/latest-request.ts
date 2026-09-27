import { Observable, Observer, Subscription } from 'rxjs';

/**
 * Une seule requête vivante par emplacement : la dernière.
 *
 * Une liste qui recharge à chaque recherche, filtre, tri, page ou mois reçoit
 * ses réponses dans l'ordre où le serveur les rend, pas dans celui où elles
 * sont parties. Sans garde, une réponse périmée — le chargement initial, plus
 * lent qu'une recherche lancée aussitôt — arrive la dernière et écrase la
 * bonne : la liste montre tout le stock sous une recherche, le reporting le
 * mois précédent sous l'étiquette du mois choisi.
 *
 * `run()` abandonne la requête précédente de l'emplacement avant de lancer la
 * nouvelle ; avec HttpClient, se désabonner annule la requête réseau. Un
 * emplacement par flux indépendant (la liste, le résumé…) :
 *
 *   private readonly listRequest = new LatestRequest();
 *   …
 *   this.listRequest.run(this.service.getList(filters), { next: …, error: … });
 *
 * Attention à `finalize()` dans la source : il s'exécute aussi quand la
 * requête est abandonnée. Si la page écrit `loading.set(true)` avant `run()`,
 * un `finalize(() => loading.set(false))` de la requête abandonnée l'éteint :
 * appeler `cancel()` avant de lever l'indicateur.
 */
export class LatestRequest {
  private subscription?: Subscription;

  /** Abandonne la requête en vol, puis lance celle-ci. */
  run<T>(source: Observable<T>, observer?: Partial<Observer<T>> | ((value: T) => void)): Subscription {
    this.cancel();
    const subscription = typeof observer === 'function' ? source.subscribe(observer) : source.subscribe(observer ?? {});
    this.subscription = subscription;
    return subscription;
  }

  /** Abandonne la requête en vol, s'il y en a une. */
  cancel(): void {
    this.subscription?.unsubscribe();
    this.subscription = undefined;
  }

  /** Vrai tant que la dernière requête lancée n'a ni répondu ni échoué. */
  get pending(): boolean {
    return !!this.subscription && !this.subscription.closed;
  }
}
