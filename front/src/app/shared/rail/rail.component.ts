import { Component, ElementRef, HostListener, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { IconComponent } from '../icon/icon.component';
import { NAV_ITEMS, NavItem } from './nav-items';

/**
 * Rail de navigation de 72px (refonte 2b, étape 3) — remplace shared/navbar/.
 * Les destinations sans enfant naviguent directement ; celles qui en ont
 * ouvrent un volet superposé à droite du rail (un seul ouvert à la fois),
 * au lieu du menu déroulant horizontal de l'ancien navbar.
 */
@Component({
  selector: 'app-rail',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, IconComponent],
  templateUrl: './rail.component.html',
  styleUrl: './rail.component.scss',
})
export class RailComponent {
  readonly allNavItems = NAV_ITEMS;

  /** Groupe dont le volet est actuellement ouvert (un seul à la fois), null si aucun. */
  openGroup = signal<string | null>(null);

  /** Position verticale du volet ouvert (`position: fixed`, calculée au clic —
   * voir le commentaire sur `toggleGroup` pour la raison). */
  flyoutTop = signal(0);

  visibleNavItems = computed<NavItem[]>(() => {
    return this.allNavItems
      .map((item) => {
        if (item.children) {
          const visibleChildren = item.children.filter(
            (child) => !child.permission || this.authService.hasPermission(child.permission),
          );
          return visibleChildren.length > 0 ? { ...item, children: visibleChildren } : null;
        }
        return !item.permission || this.authService.hasPermission(item.permission) ? item : null;
      })
      .filter((item): item is NavItem => item !== null);
  });

  /** Un groupe est actif quand la route courante correspond à l'un de ses enfants — allume l'icône même volet fermé. */
  isGroupActive(item: NavItem): boolean {
    if (!item.children) return false;
    return item.children.some((child) => child.route && this.router.url.startsWith(child.route));
  }

  constructor(
    private authService: AuthService,
    private router: Router,
    private elementRef: ElementRef<HTMLElement>,
  ) {
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => {
      this.openGroup.set(null);
    });
  }

  // Le volet est positionné en `position: fixed` (voir rail.component.scss),
  // sa coordonnée verticale calculée ici plutôt que par un `top` CSS relatif
  // à son parent : `.rail` a `overflow-y: auto` pour rester défilable quand
  // la liste dépasse la hauteur d'écran, et tout overflow non-`visible`
  // découpe aussi les enfants en `position: absolute` qui débordent
  // horizontalement — le volet aurait été rogné au bord droit du rail.
  toggleGroup(item: NavItem, event: Event): void {
    event.preventDefault();
    event.stopPropagation();

    if (this.openGroup() === item.label) {
      this.openGroup.set(null);
      return;
    }

    const button = event.currentTarget as HTMLElement;
    this.flyoutTop.set(button.getBoundingClientRect().top);
    this.openGroup.set(item.label);
  }

  isGroupOpen(item: NavItem): boolean {
    return this.openGroup() === item.label;
  }

  closeGroup(): void {
    this.openGroup.set(null);
  }

  // Un clic hors du rail (et de son volet) referme le volet ouvert — le volet
  // est projeté en `position: fixed` depuis le rail, donc toujours un
  // descendant DOM de son hôte malgré l'apparence de superposition.
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.openGroup() && !this.elementRef.nativeElement.contains(event.target as Node)) {
      this.closeGroup();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeGroup();
  }
}
