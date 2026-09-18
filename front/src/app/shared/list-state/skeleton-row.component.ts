import { ChangeDetectionStrategy, Component, computed, input, numberAttribute } from '@angular/core';

/**
 * Squelette de chargement — refonte 2b, §14c état 1.
 *
 * Remplace le `spinner` centré, qui laisse la page vide puis la fait sauter à
 * l'arrivée des données. Ici la structure de la liste se dessine tout de
 * suite, aux bonnes largeurs de colonne.
 *
 * Deux sélecteurs d'attribut plutôt qu'un composant enveloppant, pour une
 * raison d'encapsulation : appliqué sur la ligne *de la page*, l'hôte garde
 * ses propres classes, donc sa grille et ses largeurs de colonne. Un
 * `<app-skeleton>` enveloppant ne les recevrait pas.
 *
 *   grille : <div class="list-grid-row sales-grid" appSkeletonRow [cells]="9" [seed]="i">
 *   table  : <tr appSkeletonCells [cells]="7" [seed]="i">
 */

/** Largeurs de barres, en pourcentage de la cellule. */
const BAR_WIDTHS = [62, 78, 44, 70, 52, 86, 48, 74, 40];

/**
 * Motif déterministe : deux rendus successifs donnent les mêmes largeurs, donc
 * pas de scintillement à chaque cycle de détection (ni de NG0100). `seed`
 * décale le motif d'une ligne à l'autre pour éviter un damier trop régulier.
 */
function barWidths(cells: number, seed: number): number[] {
  return Array.from({ length: cells }, (_, i) => BAR_WIDTHS[(i + seed * 3) % BAR_WIDTHS.length]);
}

const SKELETON_STYLES = `
  .sk-cell {
    display: flex;
    align-items: center;
    min-width: 0;
  }

  .sk-bar {
    display: block;
    height: 10px;
    background: #e7eef8;
    background-image: linear-gradient(90deg, #e7eef8 24%, #f4f8fd 38%, #e7eef8 62%);
    background-size: 300% 100%;
    animation: sk-sweep 1.5s ease-in-out infinite;
  }

  @keyframes sk-sweep {
    from { background-position: 150% 50%; }
    to { background-position: -50% 50%; }
  }

  @media (prefers-reduced-motion: reduce) {
    .sk-bar { animation: none; }
  }
`;

/** Variante grille CSS — Ventes, Achats, Stock, Cash Flow. */
@Component({
  selector: '[appSkeletonRow]',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (width of widths(); track $index) {
      <span class="sk-cell"><span class="sk-bar" [style.width.%]="width"></span></span>
    }
  `,
  styles: [SKELETON_STYLES],
})
export class SkeletonRowComponent {
  readonly cells = input(6, { transform: numberAttribute });
  readonly seed = input(0, { transform: numberAttribute });

  readonly widths = computed(() => barWidths(this.cells(), this.seed()));
}

/** Variante `<table>` — Clients, Service Auto (vue liste). */
@Component({
  selector: 'tr[appSkeletonCells]',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (width of widths(); track $index) {
      <td><span class="sk-bar" [style.width.%]="width"></span></td>
    }
  `,
  styles: [SKELETON_STYLES],
})
export class SkeletonCellsComponent {
  readonly cells = input(6, { transform: numberAttribute });
  readonly seed = input(0, { transform: numberAttribute });

  readonly widths = computed(() => barWidths(this.cells(), this.seed()));
}
