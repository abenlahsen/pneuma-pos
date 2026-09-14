import { Injectable, signal } from '@angular/core';

/** Une action primaire de page, remontee dans la barre superieure. */
export interface PageAction {
  label: string;
  run: () => void;
  /** `primary` : l'action qui cree. Les autres sont secondaires. */
  variant?: 'primary' | 'secondary';
  /** Evalue au rendu : un export en cours desactive son bouton. */
  disabled?: () => boolean;
  /** Masque l'action sans la retirer — typiquement une permission. */
  hidden?: () => boolean;
}

/**
 * Ce qu'une page depose dans la barre superieure de la coquille.
 *
 * La barre appartient a la coquille, pas a la page : elle reste a la meme
 * hauteur et au meme endroit quel que soit l'ecran, et c'est ce qui evite les
 * vingt-six gros titres qui doublonnaient avec elle. Mais son contenu depend
 * de la page — « Bonjour Omar — 11 éléments à traiter » ne se calcule qu'une
 * fois les files chargees. D'ou ce passe-plat en signaux plutot qu'une
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

  /** Fil d'Ariane d'une fiche : « Stock / Produits / PN-4412 ». */
  readonly breadcrumb = signal<string[]>([]);

  readonly actions = signal<PageAction[]>([]);

  /**
   * L'auto-actualisation vit dans la barre, pas dans la page : c'est une
   * commande de coquille, elle doit se trouver au meme endroit partout.
   * `key` est la cle de persistance de l'intervalle, `run` le rechargement.
   */
  readonly refresh = signal<{ key: string; run: () => void } | null>(null);

  set(title: string, subtitle = '', subtitleStrong = ''): void {
    this.title.set(title);
    this.subtitle.set(subtitle);
    this.subtitleStrong.set(subtitleStrong);
  }

  setActions(actions: PageAction[]): void {
    this.actions.set(actions);
  }

  setBreadcrumb(parts: string[]): void {
    this.breadcrumb.set(parts);
  }

  setRefresh(key: string, run: () => void): void {
    this.refresh.set({ key, run });
  }

  clear(): void {
    this.set('');
    this.actions.set([]);
    this.breadcrumb.set([]);
    this.refresh.set(null);
  }
}
