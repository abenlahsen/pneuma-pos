import { ChangeDetectionStrategy, Component, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ReferentialModalComponent } from '../../../../shared/referential-modal/referential-modal.component';

/**
 * Catégorie de transaction — refonte 2b, gabarit 15b.
 *
 * Extrait des trois saisies en ligne de transaction-categories-page : ajout
 * d'une catégorie, ajout d'une sous-catégorie, renommage. Les trois portent le
 * même champ unique et se ramènent donc au même formulaire ; c'est le
 * sur-titre et le pied qui disent lequel des trois on fait.
 */
@Component({
  selector: 'app-transaction-category-form',
  standalone: true,
  imports: [FormsModule, ReferentialModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-referential-modal
      [referential]="parentName() ? 'sous-catégorie' : 'catégorie'"
      [title]="title()"
      [linked]="linked()"
      [linkedLabel]="linkedLabel()"
      (dismiss)="cancel.emit()">

      <label class="rf-field">
        <span>Nom *</span>
        <input
          type="text"
          [ngModel]="name()"
          (ngModelChange)="name.set($event)"
          name="category_name"
          [placeholder]="parentName() ? 'Nom de la sous-catégorie' : 'Nom de la catégorie'"
          (keyup.enter)="submit()"
        />
        @if (parentName()) {
          <em class="rf-hint">Sous « {{ parentName() }} ».</em>
        }
      </label>

      <ng-container actions>
        <button type="button" class="rf-btn" (click)="cancel.emit()">Annuler</button>
        <button type="button" class="rf-btn rf-btn--solid" [disabled]="!name().trim()" (click)="submit()">
          {{ initialName() ? 'Renommer' : 'Ajouter' }}
        </button>
      </ng-container>
    </app-referential-modal>
  `,
  styleUrl: './transaction-category-form.component.scss',
})
export class TransactionCategoryFormComponent {
  /** Renseigné en renommage, vide en création. */
  readonly initialName = input('');

  /** Renseigné quand on ajoute une sous-catégorie. */
  readonly parentName = input('');

  /** Nombre de sous-catégories, en renommage : ce qui dépend de cet objet. */
  readonly childCount = input<number | null>(null);

  readonly name = signal('');

  readonly save = output<string>();
  readonly cancel = output<void>();

  constructor() {
    // Le nom d'origine ne peut pas initialiser un signal à la déclaration :
    // l'entrée n'est pas encore résolue quand le champ est créé.
    effect(() => this.name.set(this.initialName()));
  }

  title(): string {
    if (this.initialName()) return `Renommer ${this.initialName()}`;

    return this.parentName() ? 'Nouvelle sous-catégorie' : 'Nouvelle catégorie';
  }

  linked(): number | null {
    return this.initialName() ? this.childCount() : null;
  }

  linkedLabel(): string {
    return 'sous-catégorie(s) liée(s)';
  }

  submit(): void {
    const value = this.name().trim();
    if (value) this.save.emit(value);
  }
}
