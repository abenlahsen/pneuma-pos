import { Injectable, signal } from '@angular/core';

/**
 * Ce qu'une page depose dans la barre superieure de la coquille.
 *
 * La barre appartient a la coquille, pas a la page : elle doit rester a la
 * meme hauteur et au meme endroit quel que soit l'ecran. Mais son texte, lui,
 * depend de la page — « Bonjour Omar — 11 éléments à traiter » ne se calcule
 * qu'une fois les files chargees. D'ou ce passe-plat en signaux plutot qu'une
 * projection de contenu, qui obligerait chaque page a connaitre la coquille.
 */
@Injectable({ providedIn: 'root' })
export class PageHeaderService {
  /** Titre de section, en capitales dans la barre. */
  readonly title = signal('');

  /** Une ligne, a cote du titre. Vide = rien d'affiche. */
  readonly subtitle = signal('');

  /** La partie du sous-titre a mettre en gras (un compte, en general). */
  readonly subtitleStrong = signal('');

  set(title: string, subtitle = '', subtitleStrong = ''): void {
    this.title.set(title);
    this.subtitle.set(subtitle);
    this.subtitleStrong.set(subtitleStrong);
  }

  clear(): void {
    this.set('');
  }
}
