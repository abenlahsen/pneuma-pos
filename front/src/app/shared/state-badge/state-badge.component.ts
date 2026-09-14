import { Component, input } from '@angular/core';

import type { Tone } from './state-tone';

/**
 * Badge d'état lu — plat, sans chevron.
 *
 *   <app-state-badge [tone]="paymentTone(sale.payment_status)">
 *     {{ sale.payment_status }}
 *   </app-state-badge>
 *
 * Le libellé reste au point d'appel : seul l'écran sait s'il affiche la valeur
 * brute ou un libellé traduit.
 *
 * L'hôte *est* le badge — pas de `<span>` interne. Deux raisons : il se pose
 * dans une cellule de tableau sans emballage, et surtout aucune règle `.badge`
 * d'un SCSS de composant parent ne peut l'atteindre. C'est ce qui rend la
 * règle réellement unique : la poser au niveau des classes ne suffisait pas,
 * dix-huit composants la réécrivaient avec une spécificité supérieure.
 */
@Component({
  selector: 'app-state-badge',
  standalone: true,
  template: '<ng-content />',
  host: { '[attr.data-tone]': 'tone()' },
  styles: [
    `
      :host {
        display: inline-flex;
        align-items: center;
        /* Un badge fait la largeur de son texte. Sans cela il s'etire sur la
           colonne des le premier conteneur en flex : dans les fiches de detail,
           une bordure de 2 px pleine largeur se lit comme un champ de saisie. */
        align-self: start;
        padding: 4px 8px;
        border: 2px solid var(--neutral-300);
        border-radius: var(--radius);
        background: transparent;
        color: var(--neutral-800);
        font-family: var(--font);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        white-space: nowrap;
      }

      /* Jamais --accent, qui ne fait que 3,7:1 a cette taille. */
      :host([data-tone='alert']) {
        border-color: var(--accent-700);
        color: var(--accent-700);
      }
    `,
  ],
})
export class StateBadgeComponent {
  readonly tone = input<Tone>('neutral');
}
