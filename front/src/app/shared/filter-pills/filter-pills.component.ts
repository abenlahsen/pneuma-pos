import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

export interface FilterPillOption {
  value: string;
  label: string;
}

/**
 * Les filtres à choix multiple des listes Ventes, Achats et Service Auto —
 * Statut, Paiement, Mode de paiement : une pastille par valeur, plusieurs
 * actives à la fois. Aucune pastille active = pas de filtre.
 *
 *   <app-filter-pills label="Paiement" [options]="…" [selected]="filterPaymentStatuses()"
 *                     (selectedChange)="filterPaymentStatuses.set($event); applyFilters()" />
 *
 * `label` nomme le groupe pour les lecteurs d'écran (et les tests e2e).
 *
 * La page garde la sélection dans son signal ; le composant ne fait que
 * rendre les pastilles et émettre la nouvelle sélection, dans l'ordre des
 * options (l'URL de l'API reste stable quel que soit l'ordre des clics).
 */
@Component({
  selector: 'app-filter-pills',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fp-group" role="group" [attr.aria-label]="label">
      @for (option of options; track option.value) {
        <button
          type="button"
          class="fp-pill"
          [class.active]="isSelected(option.value)"
          [attr.aria-pressed]="isSelected(option.value)"
          (click)="toggle(option.value)">
          {{ option.label }}
        </button>
      }
    </div>
  `,
  styleUrl: './filter-pills.component.scss',
})
export class FilterPillsComponent {
  @Input({ required: true }) options: FilterPillOption[] = [];
  @Input() selected: string[] = [];
  @Input() label = 'Statut';
  @Output() selectedChange = new EventEmitter<string[]>();

  isSelected(value: string): boolean {
    return this.selected.includes(value);
  }

  toggle(value: string): void {
    const next = new Set(this.selected);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    this.selectedChange.emit(this.options.map((o) => o.value).filter((v) => next.has(v)));
  }
}
