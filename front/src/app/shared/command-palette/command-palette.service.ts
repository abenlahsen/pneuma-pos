import { Injectable, signal } from '@angular/core';

/**
 * Ouvre et ferme la palette de commandes.
 *
 * Un service pour un seul signal, parce que deux composants distincts doivent
 * ouvrir la même palette : la zone de recherche de la barre haute, et le
 * raccourci clavier que la palette écoute elle-même. Sans ce point commun, la
 * barre haute devrait connaître la palette, ou l'inverse.
 */
@Injectable({ providedIn: 'root' })
export class CommandPaletteService {
  private readonly openState = signal(false);

  readonly isOpen = this.openState.asReadonly();

  open(): void {
    this.openState.set(true);
  }

  close(): void {
    this.openState.set(false);
  }

  toggle(): void {
    this.openState.update((open) => !open);
  }
}
