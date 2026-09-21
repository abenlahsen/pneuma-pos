import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * Coque de volet latéral — refonte 2b, quatrième gabarit du système.
 *
 * Les trois premiers couvrent l'objet que l'on modifie (15a l'éditeur plein
 * écran, 15b la modale de référentiel) et la décision que l'on confirme (15c).
 * Il manquait la surface des actions qui s'exercent *contre* ce que l'écran
 * montre déjà — encaisser des ventes, régler un fournisseur : on garde la
 * liste sous les yeux, le volet arrive par le bord et la recouvre en partie.
 *
 * C'est la seule surface, avec la modale, que le §5d autorise à porter une
 * élévation ; la sienne est directionnelle, elle dit d'où le volet vient.
 *
 * Trois zones, dont une seule défile : l'en-tête dit ce qu'on fait, le pied
 * garde ses boutons visibles pendant qu'on remplit le corps.
 *
 *   <app-side-panel kicker="Encaissement" title="Régler des ventes"
 *                   subtitle="Garage Atlas Pneus" (dismiss)="close()">
 *     …le corps…
 *     <ng-container actions>…les boutons…</ng-container>
 *   </app-side-panel>
 */
@Component({
  selector: 'app-side-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sp-veil" (click)="dismiss.emit()">
      <aside
        class="sp-panel"
        role="dialog"
        [attr.aria-label]="title()"
        [style.width.px]="width()"
        (click)="$event.stopPropagation()">

        <header class="sp-head">
          <span class="sp-identity">
            @if (kicker()) {
              <span class="sp-kicker">{{ kicker() }}</span>
            }
            <span class="sp-title">{{ title() }}</span>
          </span>

          @if (subtitle()) {
            <span class="sp-subtitle">{{ subtitle() }}</span>
          }

          <button type="button" class="sp-close" (click)="dismiss.emit()" aria-label="Fermer">×</button>
        </header>

        <div class="sp-body">
          <ng-content />
        </div>

        <footer class="sp-foot">
          <ng-content select="[actions]" />
        </footer>
      </aside>
    </div>
  `,
  styleUrl: './side-panel.component.scss',
})
export class SidePanelComponent {
  /** Sur-titre : ce que l'on fait, en petites capitales. */
  readonly kicker = input('');

  readonly title = input('');

  /** Second niveau du titre — l'objet concerné, quand il aide à se situer. */
  readonly subtitle = input('');

  /**
   * Largeur du volet. 520 px est la mesure du gabarit ; un volet qui porte un
   * tableau large peut demander davantage, mais jamais toute la fenêtre — ce
   * qui reste visible du dessous fait partie du propos.
   */
  readonly width = input(520);

  readonly dismiss = output<void>();
}
