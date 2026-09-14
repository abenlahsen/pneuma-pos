import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

/**
 * État modifiable — mêmes dimensions que `<app-state-badge>`, plus le chevron.
 *
 *   <app-state-select
 *     [value]="sale.status"
 *     [options]="statusOptionsFor(sale)"
 *     [labels]="SALE_STATUS_LABELS"
 *     [disabled]="isSaleLocked(sale)"
 *     (valueChange)="updateSaleStatus(sale, $event)" />
 *
 * Le chevron `▾` est le seul signe de modifiabilité du système : un badge plat
 * se lit, un badge à chevron se change. Aucune exception, et surtout aucune
 * couleur de statut — un état modifiable coloré se confond avec un état lu,
 * et c'est précisément le défaut que ce composant corrige.
 *
 * `valueChange` émet la valeur, pas l'événement : les pages appelantes n'ont
 * plus à déballer `$event.target.value`.
 *
 * `[ngModel]` plutôt que `[value]` : sur un `<select>`, une liaison de
 * propriété est posée avant que les `<option>` existent, et la liste retombe
 * sur sa première entrée. `SelectControlValueAccessor` gère cet ordre.
 */
@Component({
  selector: 'app-state-select',
  standalone: true,
  imports: [FormsModule],
  template: `
    <select
      [ngModel]="value()"
      [disabled]="disabled()"
      [attr.title]="title() || null"
      (ngModelChange)="valueChange.emit($event)"
    >
      @for (option of options(); track option) {
        <option [value]="option">{{ labels()[option] ?? option }}</option>
      }
    </select>
  `,
  styles: [
    `
      :host {
        display: inline-flex;
      }

      select {
        appearance: none;
        padding: 4px 24px 4px 8px;
        border: 2px solid var(--neutral-400);
        border-radius: var(--radius);
        background-color: var(--surface);
        color: var(--text);
        font-family: var(--font);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        cursor: pointer;
        /* Le chevron « ▾ », 9 px, a 7 px du texte. */
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='9' height='6' viewBox='0 0 9 6'%3E%3Cpath d='M1 1l3.5 3.5L8 1' fill='none' stroke='%23201e1d' stroke-width='1.6' stroke-linecap='round'/%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 8px center;
        transition: border-color 0.12s;
      }

      select:hover:not(:disabled) {
        border-color: var(--text);
      }

      select:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 2px;
      }

      /* Verrouillé : le chevron part avec la possibilité de changer. */
      select:disabled {
        background-image: none;
        padding-right: 8px;
        border-color: var(--neutral-300);
        color: var(--neutral-800);
        cursor: default;
      }
    `,
  ],
})
export class StateSelectComponent {
  readonly value = input.required<string>();
  readonly options = input.required<readonly string[]>();
  /** Partiel ou vide : une option sans libellé affiche sa valeur brute. */
  readonly labels = input<Record<string, string | undefined>>({});
  readonly disabled = input(false);
  readonly title = input('');

  readonly valueChange = output<string>();
}
