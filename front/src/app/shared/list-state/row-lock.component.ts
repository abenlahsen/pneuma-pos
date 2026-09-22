import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconComponent } from '../icon/icon.component';

/**
 * Action indisponible — refonte 2b, §14c état 4.
 *
 * Aujourd'hui les boutons d'action sont simplement masqués quand le rôle n'a
 * pas la permission, si bien que la colonne Actions change de largeur d'une
 * ligne à l'autre et que rien ne dit pourquoi. Ce cadenas désactivé occupe la
 * même place qu'un bouton et porte la raison dans son infobulle.
 *
 * Deux causes possibles, même traitement visuel : la ligne est verrouillée par
 * son statut, ou le rôle n'a pas la permission. C'est `reason` qui dit
 * laquelle — il doit donc être écrit pour être lu, pas générique.
 *
 * `<span>` et non `<button disabled>` : Chrome n'affiche pas l'infobulle d'un
 * bouton désactivé, et c'est justement l'infobulle qui porte l'explication.
 */
@Component({
  selector: 'app-row-lock',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="rl" [title]="reason()" role="img" [attr.aria-label]="reason()">
      <app-icon name="lock" [size]="14" />
    </span>
  `,
  // La taille vit ici et non dans le mixin de _page-layout : celui-ci écrit
  // `.list-cell--actions .list-grid-lock`, qui ne pouvait pas atteindre ce
  // cadenas pour deux raisons cumulées — la classe rendue est `.rl`, et le
  // DOM interne d'un composant enfant ne porte pas l'attribut `_ngcontent-*`
  // de la page, si bien qu'une feuille encapsulée ne le sélectionne jamais.
  // Un composant est seul à pouvoir dimensionner son propre rendu.
  styles: [
    `
      @use '../../breakpoints' as *;

      .rl {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 2rem;
        height: 2rem;
        border: 1px solid #e7eef8;
        background: #f4f8fd;
        color: #8fa3bd;
        cursor: not-allowed;

        // Même cible que les boutons voisins sous le seuil de changement de
        // forme, sinon la colonne d'actions cesse d'avoir une largeur
        // constante — ce que ce cadenas existe précisément pour garantir.
        @include below-reshape {
          width: $touch-target-mobile;
          height: $touch-target-mobile;
        }
      }
    `,
  ],
})
export class RowLockComponent {
  /** Phrase complète : « Votre rôle ne permet pas de supprimer une vente. » */
  readonly reason = input('Action indisponible.');
}
