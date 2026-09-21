import { Injectable, signal } from '@angular/core';

/** Ce qu'une liste paginée sait d'elle-même au moment où on la quitte. */
export interface ListContext {
  /** Identifiants de la page affichée, dans l'ordre du tableau. */
  ids: number[];
  page: number;
  lastPage: number;
  perPage: number;
  total: number;
}

/** Ce qu'une fiche routée a besoin de savoir pour porter ses deux flèches. */
export interface Neighbours {
  prev: number | null;
  next: number | null;
  /** « 12 / 340 » — rang global dans le résultat filtré, ou null hors contexte. */
  position: string | null;
}

const EMPTY: Neighbours = { prev: null, next: null, position: null };

/**
 * Le contexte de liste, retenu entre la liste et la fiche.
 *
 * Avant la refonte 2b, Précédent / Suivant vivait dans la modale de détail :
 * la liste était toujours là, derrière, et lui prêtait ses lignes. Depuis que
 * les fiches sont des pages, le composant de liste est détruit quand on y
 * arrive. Ce service garde donc ce qu'il savait — les identifiants de la page
 * filtrée, dans l'ordre du tableau — pour que la fiche puisse encore dire où
 * elle se trouve et vers quoi aller.
 *
 * Il est délibérément ignorant : il ne sait pas charger une page, il retient
 * celle qu'on lui a donnée. Conséquence assumée, au bord d'une page les
 * flèches s'éteignent au lieu d'enjamber vers la suivante — ce que faisait la
 * modale, qui pouvait demander à la liste de recharger.
 *
 * `scope` sépare les listes : 'sales', 'purchases', et ce qui viendra.
 */
@Injectable({ providedIn: 'root' })
export class ListContextService {
  private readonly contexts = signal<Record<string, ListContext>>({});

  /** Appelé par la page de liste à chaque chargement. */
  set(scope: string, context: ListContext): void {
    this.contexts.update((all) => ({ ...all, [scope]: context }));
  }

  get(scope: string): ListContext | null {
    return this.contexts()[scope] ?? null;
  }

  clear(scope: string): void {
    this.contexts.update((all) => {
      const { [scope]: _removed, ...rest } = all;
      return rest;
    });
  }

  /**
   * Les voisins d'un enregistrement dans la page retenue. Tout est null quand
   * on arrive sur la fiche autrement que par la liste — lien direct, favori,
   * rechargement : il n'y a alors pas d'ordre à suivre, et prétendre le
   * contraire ferait sauter d'une vente à une autre sans raison visible.
   */
  neighbours(scope: string, id: number): Neighbours {
    const context = this.get(scope);
    if (!context) return EMPTY;

    const index = context.ids.indexOf(id);
    if (index === -1) return EMPTY;

    return {
      prev: index > 0 ? context.ids[index - 1] : null,
      next: index < context.ids.length - 1 ? context.ids[index + 1] : null,
      position: `${(context.page - 1) * context.perPage + index + 1} / ${context.total}`,
    };
  }
}
