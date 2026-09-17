import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconComponent } from './icon.component';

/**
 * Indicateur de tri d'en-tête de colonne — remplace le ternaire dupliqué
 * `{{ sortBy() === 'x' ? (sortDirection() === 'asc' ? '▲' : '▼') : '⇅' }}`
 * répété dans chaque page de liste (refonte 2b, étape 1).
 *
 * Usage : <app-sort-icon [active]="sortBy() === 'x'" [dir]="sortDirection()" />
 */
@Component({
  selector: 'app-sort-icon',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (active()) {
      <app-icon [name]="dir() === 'asc' ? 'chevron-up' : 'chevron-down'" [size]="12" />
    } @else {
      <app-icon name="more" [size]="12" style="transform: rotate(90deg)" />
    }
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        opacity: 0.6;
      }
    `,
  ],
})
export class SortIconComponent {
  readonly active = input<boolean>(false);
  readonly dir = input<'asc' | 'desc'>('asc');
}
