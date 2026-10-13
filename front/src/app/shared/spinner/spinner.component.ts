import { ChangeDetectionStrategy, Component, booleanAttribute, input, numberAttribute } from '@angular/core';

/**
 * Anneau d'attente — refonte 2b, étape 14a (maquette 21a).
 *
 * Le seul indicateur d'attente de l'application : 14 px en trait de 2 px, ou
 * 12 px dans la barre de filtres. Il prend la couleur du texte qu'il remplace
 * (`currentColor`), si bien qu'un même composant sert le bouton rouge (anneau
 * blanc), l'action de ligne (anneau rouge) et la liste (anneau gris) sans
 * variante de couleur à maintenir.
 *
 *   <app-spinner />                       — role="status", « Chargement en cours »
 *   <app-spinner label="Réception du lot" />
 *   <app-spinner size="12" />
 *   <app-spinner decorative />            — quand le libellé voisin dit déjà tout
 *
 * `decorative` existe pour le bouton et le bandeau : leur texte (« Enregistrement… »,
 * « Toujours en cours… ») est déjà lu, et un second état annoncé le doublerait.
 */
@Component({
  selector: 'app-spinner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
  host: {
    '[class.sp-sm]': 'size() === 12',
    '[attr.role]': 'decorative() ? null : "status"',
    '[attr.aria-label]': 'decorative() ? null : label()',
    '[attr.aria-hidden]': 'decorative() ? "true" : null',
  },
  styles: [
    `
      :host {
        position: relative;
        display: inline-block;
        flex-shrink: 0;
        width: 14px;
        height: 14px;
        vertical-align: middle;
      }

      :host(.sp-sm) {
        width: 12px;
        height: 12px;
      }

      :host::before,
      :host::after {
        content: '';
        position: absolute;
        inset: 0;
        border: 2px solid currentColor;
        border-radius: 50%;
      }

      /* La piste : la même couleur, estompée. */
      :host::before {
        opacity: 0.3;
      }

      :host::after {
        border-color: currentColor transparent transparent;
        animation: sp-turn 0.8s linear infinite;
      }

      @keyframes sp-turn {
        to {
          transform: rotate(360deg);
        }
      }

      /* Sans animation, un point fixe : le libellé voisin suffit à dire qu'on attend. */
      @media (prefers-reduced-motion: reduce) {
        :host::before {
          display: none;
        }

        :host::after {
          inset: 30%;
          border: 0;
          background: currentColor;
          animation: none;
        }
      }
    `,
  ],
})
export class SpinnerComponent {
  /** 14 (défaut) ou 12. */
  readonly size = input(14, { transform: numberAttribute });

  /** Ce qui attend, pour un lecteur d'écran. */
  readonly label = input('Chargement en cours');

  /** Ni rôle ni libellé : le texte voisin porte déjà l'information. */
  readonly decorative = input(false, { transform: booleanAttribute });
}
