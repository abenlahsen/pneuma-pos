import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ReferentialModalComponent } from '../../../../shared/referential-modal/referential-modal.component';

/**
 * Création d'une permission — refonte 2b, gabarit 15b.
 *
 * Extrait de la modale écrite en ligne dans roles-page : un seul champ, c'est
 * exactement le cas que la modale de référentiel sert.
 */
@Component({
  selector: 'app-permission-form',
  standalone: true,
  imports: [FormsModule, ReferentialModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-referential-modal
      referential="permission"
      title="Nouvelle permission"
      [linked]="roleCount()"
      [linkedLabel]="linkedLabel()"
      (dismiss)="cancel.emit()">

      <label class="rf-field">
        <span>Nom de la permission *</span>
        <input
          type="text"
          [ngModel]="name()"
          (ngModelChange)="name.set($event)"
          name="permission_name"
          placeholder="Ex: view dashboard"
          (keyup.enter)="submit()"
        />
        <em class="rf-hint">Format attendu : action ressource — « view sales », « edit purchases ».</em>
      </label>

      <ng-container actions>
        <button type="button" class="rf-btn" (click)="cancel.emit()">Annuler</button>
        <button type="button" class="rf-btn rf-btn--solid" [disabled]="!name().trim()" (click)="submit()">Créer</button>
      </ng-container>
    </app-referential-modal>
  `,
  styleUrl: './permission-form.component.scss',
})
export class PermissionFormComponent {
  /** Nombre de rôles existants — ce qui pourra dépendre de cette permission. */
  readonly roleCount = input<number | null>(null);

  readonly name = signal('');

  readonly save = output<string>();
  readonly cancel = output<void>();

  /** En français, zéro prend le singulier : « 1 rôle pourra la porter ». */
  linkedLabel(): string {
    return (this.roleCount() ?? 0) > 1 ? 'rôles pourront la porter' : 'rôle pourra la porter';
  }

  submit(): void {
    const value = this.name().trim();
    if (value) this.save.emit(value);
  }
}
