import { Component, input, output } from '@angular/core';
import { IconComponent } from '../icon/icon.component';

/**
 * État vide (`3b`) — dit *pourquoi* c'est vide et propose la sortie.
 * Jamais un tableau à zéro ligne sans explication.
 *
 *   <app-empty-state
 *     title="Aucune vente sur cette période"
 *     message="Le filtre « Impayées » est actif sur les 7 derniers jours."
 *     secondaryLabel="Retirer le filtre"
 *     primaryLabel="Nouvelle vente"
 *     (secondaryAction)="resetFilters()"
 *     (primaryAction)="openForm()" />
 *
 * Le message est composé par la page : elle seule connaît les filtres actifs.
 * Un bouton sans libellé n'est pas rendu.
 */
@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [IconComponent],
  templateUrl: './empty-state.component.html',
  styleUrl: './empty-state.component.scss',
})
export class EmptyStateComponent {
  readonly icon = input('inventory');
  readonly title = input.required<string>();
  readonly message = input('');
  readonly secondaryLabel = input('');
  readonly primaryLabel = input('');

  readonly secondaryAction = output<void>();
  readonly primaryAction = output<void>();
}
