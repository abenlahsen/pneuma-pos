import { Injectable, signal } from '@angular/core';

/**
 * L'état du rail sous le seuil de changement de forme — refonte 2b, 8a.
 *
 * Au-dessus de 900 px le rail est une colonne : il est toujours là, il n'a pas
 * d'état. En dessous il devient un volet que le ☰ de la barre haute ouvre, et
 * cet état doit être partagé entre deux composants frères — la barre qui
 * l'ouvre et le rail qui s'affiche. D'où ce service, plutôt qu'une entrée
 * remontée dans le composant racine : la barre basse en aura besoin aussi.
 */
@Injectable({ providedIn: 'root' })
export class ShellNavService {
  readonly panelOpen = signal(false);

  toggle(): void {
    this.panelOpen.update((open) => !open);
  }

  open(): void {
    this.panelOpen.set(true);
  }

  /**
   * Fermé à chaque navigation : un volet qui resterait ouvert sur l'écran
   * d'arrivée masquerait ce qu'on vient de demander.
   */
  close(): void {
    this.panelOpen.set(false);
  }
}
