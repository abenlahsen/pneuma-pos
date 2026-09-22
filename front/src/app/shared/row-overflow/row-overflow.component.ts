import { ChangeDetectionStrategy, Component, ElementRef, HostListener, inject, signal } from '@angular/core';
import { IconComponent } from '../icon/icon.component';

/**
 * Le menu ⋯ d'une ligne de liste — refonte 2b, 8b, gabarit 14a.
 *
 * « Au-delà de deux boutons, les actions passent derrière un menu ⋯ ». Le
 * composant ne prend pas une liste d'actions en entrée : il les reçoit par
 * projection, et les rend de deux façons selon la largeur.
 *
 *   <app-row-overflow>
 *     <button class="ro-item" …>Modifier</button>
 *     <button class="ro-item" …>Supprimer</button>
 *   </app-row-overflow>
 *
 * Au-dessus du seuil de réduction, la projection est en `display: contents` :
 * les boutons tombent dans la rangée d'actions comme s'il n'y avait pas de
 * menu, et le ⋯ n'existe pas. En dessous, ils se replient derrière lui.
 *
 * C'est ce qui permet à la page de ne déclarer ses actions qu'une fois. Un
 * composant qui aurait pris des `items` aurait forcé chaque écran à décrire
 * ses boutons deux fois — une en gabarit, une en données — et à garder les
 * deux d'accord.
 */
@Component({
  selector: 'app-row-overflow',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <button
      type="button"
      class="ro-toggle"
      [class.ro-toggle--on]="open()"
      [attr.aria-expanded]="open()"
      aria-label="Autres actions"
      title="Autres actions"
      (click)="toggle($event)">
      <app-icon name="more" [size]="15" />
    </button>

    <span class="ro-items" [class.ro-items--open]="open()">
      <ng-content />
    </span>
  `,
  styleUrl: './row-overflow.component.scss',
})
export class RowOverflowComponent {
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly open = signal(false);

  toggle(event: Event): void {
    event.stopPropagation();
    this.open.update((o) => !o);
  }

  close(): void {
    this.open.set(false);
  }

  /**
   * Un clic dans le menu le referme aussi : les actions projetées font leur
   * travail puis le panneau n'a plus de raison d'être ouvert. Sauf sur le
   * sélecteur de statut, qui a besoin de rester ouvert le temps du choix.
   */
  @HostListener('click', ['$event'])
  onInsideClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (target.closest('.ro-toggle') || target.closest('.ro-keep-open')) return;
    if (target.closest('.ro-item')) this.close();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.open()) return;
    if (!this.host.nativeElement.contains(event.target as Node)) this.close();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close();
  }
}
