import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Permission, Role } from '../../models/role.model';

/**
 * Rôle et ses permissions — refonte 2b.
 *
 * Extrait de la modale écrite en ligne dans roles-page. Il ne prend PAS la
 * coque 15b : celle-ci fait 480 px sans défilement interne, et ce formulaire
 * porte 83 permissions réparties en une vingtaine de groupes. Le §5b tranche
 * lui-même le cas — « au-delà de dix champs ou d'une section dépendante, on
 * sort de la modale » — et renvoie au gabarit 15a, l'éditeur plein écran.
 *
 * Il en reprend donc les trois rangées : barre, corps, pied d'actions.
 */
@Component({
  selector: 'app-role-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './role-form.component.html',
  styleUrl: './role-form.component.scss',
})
export class RoleFormComponent {
  readonly role = input<Role | null>(null);
  readonly grouped = input<Map<string, Permission[]>>(new Map());
  readonly resourceLabel = input<(resource: string) => string>((r) => r);
  readonly actionLabel = input<(permission: string) => string>((p) => p);

  readonly name = signal('');
  readonly selected = signal<Set<number>>(new Set());

  readonly save = output<{ name: string; permissions: number[] }>();
  readonly cancel = output<void>();

  /** Compte affiché en barre : ce que le rôle accordera réellement. */
  readonly selectedCount = computed(() => this.selected().size);

  readonly totalCount = computed(() =>
    [...this.grouped().values()].reduce((sum, list) => sum + list.length, 0),
  );

  constructor() {
    effect(() => {
      const role = this.role();
      this.name.set(role?.name ?? '');
      this.selected.set(new Set((role?.permissions ?? []).map((permission) => permission.id)));
    });
  }

  has(id: number): boolean {
    return this.selected().has(id);
  }

  toggle(id: number): void {
    this.selected.update((current) => {
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  allSelectedFor(resource: string): boolean {
    const list = this.grouped().get(resource) ?? [];
    return list.length > 0 && list.every((permission) => this.selected().has(permission.id));
  }

  toggleResource(resource: string): void {
    const list = this.grouped().get(resource) ?? [];
    const all = this.allSelectedFor(resource);

    this.selected.update((current) => {
      const next = new Set(current);
      for (const permission of list) {
        all ? next.delete(permission.id) : next.add(permission.id);
      }
      return next;
    });
  }

  selectAll(): void {
    this.selected.set(new Set([...this.grouped().values()].flat().map((p) => p.id)));
  }

  deselectAll(): void {
    this.selected.set(new Set());
  }

  submit(): void {
    const name = this.name().trim();
    if (name) this.save.emit({ name, permissions: [...this.selected()] });
  }
}
