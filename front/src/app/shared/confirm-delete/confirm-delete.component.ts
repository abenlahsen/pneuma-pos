import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';

/**
 * Confirmation de suppression — refonte 2b, gabarit 15c.
 *
 * Remplace les `confirm()` natifs, qui ne disent jamais ce que la suppression
 * coûte et dont le bouton d'action est celui que l'œil suit par défaut.
 *
 * Deux inversions par rapport à l'usage courant, toutes deux voulues :
 *
 *  - « Annuler » est l'action solide, « Supprimer » l'action bordée. Le geste
 *    par défaut doit être celui qui ne détruit rien.
 *  - La conséquence est chiffrée **dans le corps du message**, avant le
 *    bouton — « 4 pneus sortiront du stock » — jamais après, où plus personne
 *    ne la lit.
 *
 * Le champ de motif n'apparaît que là où le serveur l'exige : `reasonRequired`
 * est une contrainte d'API, pas une précaution d'interface.
 */
@Component({
  selector: 'app-confirm-delete',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="cd-overlay" (click)="cancel.emit()">
      <div class="cd-box" role="alertdialog" [attr.aria-label]="title()" (click)="$event.stopPropagation()">
        <header class="cd-head">
          <span class="cd-kicker">Suppression définitive</span>
          <h2 class="cd-title">{{ title() }}</h2>
        </header>

        <div class="cd-body">
          @if (consequence()) {
            <p class="cd-consequence">{{ consequence() }}</p>
          }

          @if (detail()) {
            <p class="cd-detail">{{ detail() }}</p>
          }

          @if (reasonRequired()) {
            <label class="cd-reason">
              <span>Motif *</span>
              <input
                type="text"
                [value]="reason()"
                (input)="reason.set($any($event.target).value)"
                placeholder="Pourquoi cette suppression ?"
                maxlength="1000"
              />
            </label>
          }
        </div>

        <footer class="cd-foot">
          <button type="button" class="cd-btn cd-btn--solid" (click)="cancel.emit()">Annuler</button>
          <button
            type="button"
            class="cd-btn cd-btn--danger"
            [disabled]="reasonRequired() && reason().trim().length < 3"
            (click)="confirm.emit(reason().trim())"
          >
            {{ confirmLabel() }}
          </button>
        </footer>
      </div>
    </div>
  `,
  styleUrl: './confirm-delete.component.scss',
})
export class ConfirmDeleteComponent {
  /** « Supprimer le lot Tanger · C-01 ? » — nomme l'objet, pas l'action. */
  readonly title = input('Supprimer cet élément ?');

  /** Ce que la suppression coûte, chiffré : « 4 pneus sortiront du stock ». */
  readonly consequence = input('');

  /** Précision secondaire : trace écrite, irréversibilité, effets de bord. */
  readonly detail = input('');

  readonly confirmLabel = input('Supprimer');

  /** Vrai seulement quand le serveur refuse la suppression sans motif. */
  readonly reasonRequired = input(false);

  readonly reason = signal('');

  /** Émet le motif saisi, ou une chaîne vide quand il n'est pas demandé. */
  readonly confirm = output<string>();
  readonly cancel = output<void>();
}
