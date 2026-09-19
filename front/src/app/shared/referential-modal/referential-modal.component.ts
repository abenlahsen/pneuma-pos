import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * Coque de modale de référentiel — refonte 2b, gabarit 15b.
 *
 * Pour les objets à trois ou cinq champs : marque, transporteur, rôle,
 * catégorie. Au-delà de dix champs ou d'une section dépendante, on sort de la
 * modale pour l'éditeur 15a — une boîte de dialogue qui défile fait perdre de
 * vue ses propres boutons.
 *
 * Trois éléments que la coque impose et que les formulaires n'ont plus à
 * redire : le sur-titre qui nomme le référentiel, la largeur fixe de 480 px
 * sans défilement interne, et le pied qui annonce ce qui dépend de l'objet —
 * « 412 produits liés », ce qui prévient une désactivation à l'aveugle.
 *
 * Le corps et les actions arrivent par projection, sur deux emplacements :
 *
 *   <app-referential-modal referential="marque" title="Modifier MICHELIN"
 *                          [linked]="412" linkedLabel="produits liés"
 *                          (dismiss)="close()">
 *     …les champs…
 *     <ng-container actions>…les boutons…</ng-container>
 *   </app-referential-modal>
 */
@Component({
  selector: 'app-referential-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rm-overlay" (click)="dismiss.emit()">
      <div class="rm-box" role="dialog" [attr.aria-label]="title()" (click)="$event.stopPropagation()">
        <header class="rm-head">
          <span class="rm-kicker">Référentiel · {{ referential() }}</span>
          <h2 class="rm-title">{{ title() }}</h2>
        </header>

        <div class="rm-body">
          <ng-content />
        </div>

        <footer class="rm-foot">
          <span class="rm-linked">
            @if (linked() !== null) {
              {{ linked() }} {{ linkedLabel() }}
            }
          </span>
          <ng-content select="[actions]" />
        </footer>
      </div>
    </div>
  `,
  styleUrl: './referential-modal.component.scss',
})
export class ReferentialModalComponent {
  /** Nom du référentiel, affiché en sur-titre : « marque », « transporteur ». */
  readonly referential = input('');

  readonly title = input('');

  /**
   * Nombre d'objets qui dépendent de celui-ci. `null` quand on ne le sait pas :
   * on n'affiche alors rien, plutôt qu'un zéro qui se lirait comme « aucun ».
   */
  readonly linked = input<number | null>(null);

  readonly linkedLabel = input('objets liés');

  readonly dismiss = output<void>();
}
