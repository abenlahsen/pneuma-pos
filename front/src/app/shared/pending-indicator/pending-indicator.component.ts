import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { PendingRequestsService } from '../../core/services/pending-requests.service';
import { SpinnerComponent } from '../spinner/spinner.component';

/**
 * Indicateur global d'attente — refonte 2b, étape 14a (maquette 21a, encadré 4).
 *
 * Deux paliers, tous deux pilotés par `PendingRequestsService` :
 *   - après 300 ms, une barre de 3 px défile au bas de la barre haute ;
 *   - après 8 s, le bandeau « Toujours en cours… » s'ajoute en bas à droite.
 * Ils disparaissent seuls à la réponse ; une erreur, elle, est dite par
 * l'écran qui a lancé la requête (état d'erreur de 8c).
 *
 * Rien ici ne bloque : ni voile, ni curseur d'attente, et les deux éléments
 * laissent passer les clics (`pointer-events: none`). Le bandeau couvre le
 * coin où se trouve le pied d'un volet latéral ; il ne doit pas en capter
 * les clics.
 *
 * Fixés au viewport plutôt que placés dans la grille du shell, pour passer
 * au-dessus des voiles des modales et des volets (z-index 1000 au plus) :
 * c'est justement quand un volet enregistre qu'on a besoin de les voir.
 */
@Component({
  selector: 'app-pending-indicator',
  standalone: true,
  imports: [SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (pending.busy()) {
      <div class="pi-bar" aria-hidden="true"><span class="pi-bar-head"></span></div>
    }

    <!-- La région existe avant le bandeau : une région live insérée en même
         temps que son texte n'est pas lue par tous les lecteurs d'écran. -->
    <div class="pi-region" role="status" aria-live="polite">
      @if (pending.slow()) {
        <div class="pi-toast">
          <app-spinner class="pi-toast-ring" decorative />
          <span class="pi-toast-text">
            <span class="pi-toast-title">Toujours en cours…</span>
            <span class="pi-toast-body">
              Le serveur met plus de temps que d'habitude. N'actualisez pas la page : votre
              saisie est conservée.
            </span>
          </span>
        </div>
      }
    </div>
  `,
  styles: [
    `
      @use '../../breakpoints' as *;

      .pi-bar {
        position: fixed;
        // Posée sur le bord bas de la barre haute, à la place de son filet :
        // elle ne recouvre ni le rail ni le haut du contenu.
        top: $topbar-height - 3px;
        left: 0;
        right: 0;
        z-index: 1100;
        height: 3px;
        overflow: hidden;
        background: #e7eef8;
        pointer-events: none;

        @include below-reduce {
          top: $topbar-height-reduced - 3px;
        }
      }

      .pi-bar-head {
        position: absolute;
        top: 0;
        bottom: 0;
        left: 0;
        width: 35%;
        background: #ff2d37;
        // transform plutôt que left : le défilement ne relance pas la mise
        // en page à chaque image. 100 / 35 ≈ 286 % de sa propre largeur.
        animation: pi-slide 1.2s ease-in-out infinite;
      }

      @keyframes pi-slide {
        from {
          transform: translateX(-100%);
        }
        to {
          transform: translateX(286%);
        }
      }

      .pi-region {
        position: fixed;
        right: 1.5rem;
        bottom: 1.5rem;
        z-index: 1100;
        max-width: 360px;
        pointer-events: none;

        // La barre basse occupe le bas de l'écran sous ce seuil.
        @include below-reshape {
          left: 0.75rem;
          right: 0.75rem;
          bottom: calc(#{$bottombar-total} + 0.75rem);
          max-width: none;
        }
      }

      .pi-toast {
        display: flex;
        align-items: flex-start;
        gap: 11px;
        padding: 12px 14px;
        background: #0c1e33;
        color: #ffffff;
        animation: pi-appear 0.16s ease-out;
      }

      @keyframes pi-appear {
        from {
          opacity: 0;
          transform: translateY(6px);
        }
      }

      .pi-toast-ring {
        margin-top: 2px;
      }

      .pi-toast-text {
        display: flex;
        flex-direction: column;
        gap: 3px;
      }

      .pi-toast-title {
        font-size: 13px;
        font-weight: 600;
      }

      .pi-toast-body {
        font-size: 11.5px;
        line-height: 1.5;
        color: rgba(230, 237, 247, 0.8);
      }

      // Sans animation : une barre pleine et fixe dit « en cours » sans défiler.
      @media (prefers-reduced-motion: reduce) {
        .pi-bar-head {
          width: 100%;
          animation: none;
        }

        .pi-toast {
          animation: none;
        }
      }
    `,
  ],
})
export class PendingIndicatorComponent {
  protected readonly pending = inject(PendingRequestsService);
}
