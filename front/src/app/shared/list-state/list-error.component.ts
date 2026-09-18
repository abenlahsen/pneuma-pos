import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';

/**
 * Erreur de chargement — refonte 2b, §14c état 3.
 *
 * Dit ce qui a échoué, ce qui est préservé, et laisse la main : le détail
 * technique reste accessible sans être affiché.
 *
 * Pas de nouvelle tentative automatique : sur un poste de comptoir qui
 * rafraîchit déjà périodiquement, réessayer tout seul contre un serveur qui
 * tousse ne fait qu'ajouter de la charge. Le bouton est manuel, et l'heure de
 * la dernière donnée affichée dit à l'utilisateur ce qu'il a sous les yeux.
 */
@Component({
  selector: 'app-list-error',
  standalone: true,
  imports: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="lx">
      <p class="lx-title">{{ title() }}</p>
      <p class="lx-cause">{{ cause() }} Vos filtres sont conservés.</p>

      <div class="lx-actions">
        <button type="button" class="lx-retry" (click)="retry.emit()">Réessayer</button>
        @if (detail()) {
          <button type="button" class="lx-toggle" (click)="detailOpen.set(!detailOpen())">
            {{ detailOpen() ? 'Masquer le détail technique' : 'Détail technique' }}
          </button>
        }
      </div>

      @if (detailOpen() && detail()) {
        <pre class="lx-detail">{{ detail() }}</pre>
      }

      @if (lastLoadedAt()) {
        <p class="lx-stamp">Dernière donnée affichée : {{ lastLoadedAt() | date: 'HH:mm' }}</p>
      }
    </div>
  `,
  styles: [
    `
      .lx {
        padding: 2rem 1.5rem;
        border-left: 3px solid #c2181f;
        background: #fdeff1;
      }

      .lx-title {
        margin: 0;
        font-size: 0.95rem;
        font-weight: 600;
        color: #8f1218;
      }

      .lx-cause {
        margin: 0.35rem 0 0;
        font-size: 0.8125rem;
        color: #41546e;
      }

      .lx-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        margin-top: 1rem;
      }

      .lx-retry,
      .lx-toggle {
        padding: 0.4rem 0.9rem;
        font-size: 0.8125rem;
        cursor: pointer;
      }

      .lx-retry {
        border: none;
        background: #c2181f;
        color: #ffffff;
        font-weight: 600;
      }

      .lx-toggle {
        border: 1px solid #adc2da;
        background: #ffffff;
        color: #41546e;
      }

      .lx-detail {
        margin: 0.75rem 0 0;
        padding: 0.6rem 0.75rem;
        max-height: 9rem;
        overflow: auto;
        border: 1px solid #e7eef8;
        background: #ffffff;
        font-size: 0.75rem;
        white-space: pre-wrap;
        word-break: break-word;
        color: #41546e;
      }

      .lx-stamp {
        margin: 0.75rem 0 0;
        font-size: 0.75rem;
        color: #4a5c75;
      }
    `,
  ],
})
export class ListErrorComponent {
  /** « Les ventes n'ont pas pu être chargées. » */
  readonly title = input('Le chargement a échoué.');

  /** « Le serveur n'a pas répondu. » — une phrase, ponctuée. */
  readonly cause = input('Le serveur n\'a pas répondu.');

  /** Message technique, replié par défaut. */
  readonly detail = input<string | null>(null);

  /** Heure du dernier chargement réussi, si la liste en montre encore le résultat. */
  readonly lastLoadedAt = input<Date | null>(null);

  readonly retry = output<void>();

  readonly detailOpen = signal(false);
}
