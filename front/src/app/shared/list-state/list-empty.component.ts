import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { ActiveFilter } from './active-filter.model';

/**
 * Liste vide — refonte 2b, §14c état 2.
 *
 * Distingue deux vides que le message unique « Aucune vente trouvée. »
 * confondait : il n'y a rien à voir, ou bien les filtres ont tout écarté. Dans
 * le second cas on nomme les filtres responsables et on propose de les retirer
 * un par un ou tous, au lieu de laisser l'utilisateur chercher pourquoi.
 */
@Component({
  selector: 'app-list-empty',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="le">
      @if (filters().length === 0) {
        <p class="le-title">{{ blankTitle() }}</p>
      } @else {
        <p class="le-title">{{ noMatchTitle() }}</p>
        <p class="le-why">
          {{ filters().length }} filtre{{ filters().length > 1 ? 's sont actifs' : ' est actif' }} :
          {{ filterNames() }}.
        </p>
        <div class="le-actions">
          @for (filter of filters(); track filter.label) {
            <button type="button" class="le-chip" (click)="filter.clear()">
              Retirer «&nbsp;{{ filter.label }}&nbsp;»
            </button>
          }
          <button type="button" class="le-chip le-chip--all" (click)="clearAll.emit()">Tout effacer</button>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .le {
        padding: 2.5rem 1.5rem;
        text-align: center;
      }

      .le-title {
        margin: 0;
        font-size: 0.95rem;
        font-weight: 600;
        color: #0c1e33;
      }

      .le-why {
        margin: 0.4rem 0 0;
        font-size: 0.8125rem;
        color: #4a5c75;
      }

      .le-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        justify-content: center;
        margin-top: 1rem;
      }

      .le-chip {
        padding: 0.35rem 0.7rem;
        border: 1px solid #adc2da;
        background: #ffffff;
        font-size: 0.75rem;
        color: #41546e;
        cursor: pointer;
      }

      .le-chip:hover {
        border-color: #0c1e33;
        color: #0c1e33;
      }

      .le-chip--all {
        border-color: #0c1e33;
        background: #0c1e33;
        color: #ffffff;
      }

      .le-chip--all:hover {
        color: #ffffff;
      }
    `,
  ],
})
export class ListEmptyComponent {
  /** Affiché quand aucun filtre n'est actif : « Aucune vente enregistrée. » */
  readonly blankTitle = input('Rien à afficher.');

  /** Affiché quand des filtres écartent tout : « Aucune vente ne correspond ». */
  readonly noMatchTitle = input('Aucun résultat ne correspond');

  readonly filters = input<ActiveFilter[]>([]);

  readonly clearAll = output<void>();

  filterNames(): string {
    return this.filters()
      .map((filter) => filter.label)
      .join(', ');
  }
}
