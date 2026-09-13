import { Component, computed, input } from '@angular/core';

/** Largeurs cyclées : un squelette uniforme se lit comme un bug de rendu. */
const WIDTHS = ['72%', '46%', '88%', '58%', '64%', '40%', '80%', '52%'];

/**
 * Squelette de tableau (`3c`) — reprend la géométrie exacte du tableau qu'il
 * remplace : même nombre de colonnes, mêmes hauteurs de ligne, donc la page
 * ne saute pas à l'arrivée des données. Pas de spinner.
 *
 * S'utilise *à la place du `<tbody>`*, pour hériter du gabarit de colonnes :
 *
 *   <tbody app-table-skeleton [columns]="17" *ngIf="loading()"></tbody>
 *
 * Les largeurs sont déterministes (pas de Math.random) : elles ne changent
 * pas d'un cycle de détection à l'autre.
 */
@Component({
  selector: 'tbody[app-table-skeleton]',
  standalone: true,
  templateUrl: './table-skeleton.component.html',
  styleUrl: './table-skeleton.component.scss',
})
export class TableSkeletonComponent {
  readonly columns = input.required<number>();
  readonly rows = input(6);

  readonly grid = computed(() =>
    Array.from({ length: this.rows() }, (_, row) =>
      Array.from({ length: this.columns() }, (_, col) => WIDTHS[(row * 3 + col) % WIDTHS.length]),
    ),
  );
}
