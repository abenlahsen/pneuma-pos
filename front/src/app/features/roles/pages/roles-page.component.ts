import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../../../shared/icon/icon.component';
import { FormsModule } from '@angular/forms';
import { RoleService } from '../data-access/role.service';
import { AuthService } from '../../../core/services/auth.service';
import { Permission, Role } from '../models/role.model';
import { AutoRefreshControlComponent } from '../../../shared/auto-refresh-control/auto-refresh-control.component';
import { ConfirmDeleteComponent } from '../../../shared/confirm-delete/confirm-delete.component';
import { PendingDelete } from '../../../shared/confirm-delete/pending-delete';
import { RoleFormComponent } from '../components/role-form/role-form.component';
import { PermissionFormComponent } from '../components/permission-form/permission-form.component';
import {
  ListEmptyComponent,
  ListErrorComponent,
  SkeletonCellsComponent,
  describeLoadError,
} from '../../../shared/list-state';

@Component({
  selector: 'app-roles-page',
  standalone: true,
  imports: [CommonModule, FormsModule, AutoRefreshControlComponent, IconComponent, SkeletonCellsComponent, ListEmptyComponent, ListErrorComponent, ConfirmDeleteComponent, RoleFormComponent, PermissionFormComponent],
  templateUrl: './roles-page.component.html',
  styleUrls: ['./roles-page.component.scss'],
})
export class RolesPageComponent implements OnInit {

  // ── Suppression : confirmation 15c au lieu d'un confirm() natif ───────────
  readonly pendingDelete = signal<PendingDelete | null>(null);

  runPendingDelete(reason: string): void {
    const pending = this.pendingDelete();
    this.pendingDelete.set(null);
    pending?.run(reason);
  }
  roles = signal<Role[]>([]);
  permissions = signal<Permission[]>([]);
  loading = signal(false);

  // ── Refonte 2b, §14c : les quatre états manquants ─────────────────────────
  // Pas de filtres sur cet écran : la liste vide ne peut être qu'un vrai vide.
  readonly skeletonRows = [0, 1, 2, 3, 4, 5, 6, 7];
  readonly loadError = signal<string | null>(null);
  readonly loadErrorDetail = signal<string | null>(null);
  readonly lastLoadedAt = signal<Date | null>(null);

  showForm = signal(false);
  editingRole = signal<Role | null>(null);

  showPermissionForm = signal(false);

  groupedPermissions = signal<Map<string, Permission[]>>(new Map());

  constructor(
    private roleService: RoleService,
    public authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    this.roleService.getRoles({ all: true }).subscribe({
      next: (roles) => {
        this.roles.set(roles as Role[]);
        this.loading.set(false);
        this.loadError.set(null);
        this.lastLoadedAt.set(new Date());
      },
      error: (err) => {
        const { cause, detail } = describeLoadError(err);
        this.loadError.set(cause);
        this.loadErrorDetail.set(detail);
        this.loading.set(false);
      },
    });

    this.roleService.getPermissions({ all: true }).subscribe({
      next: (permissions) => {
        const perms = permissions as Permission[];
        this.permissions.set(perms);
        this.buildGroupedPermissions(perms);
      },
    });
  }

  private buildGroupedPermissions(permissions: Permission[]): void {
    const grouped = new Map<string, Permission[]>();

    for (const perm of permissions) {
      const parts = perm.name.split(' ');
      const resource = parts.length > 1 ? parts.slice(1).join(' ') : perm.name;

      if (!grouped.has(resource)) {
        grouped.set(resource, []);
      }

      grouped.get(resource)!.push(perm);
    }

    this.groupedPermissions.set(grouped);
  }

  getResourceLabel(resource: string): string {
    const labels: Record<string, string> = {
      sales: 'Ventes',
      purchases: 'Achats',
      suppliers: 'Fournisseurs',
      carriers: 'Transporteurs',
      partners: 'Partenaires',
      'cash-flow': 'Cash Flow',
      users: 'Utilisateurs',
      roles: 'Rôles',
    };

    return labels[resource] || resource;
  }

  getActionLabel(permissionName: string): string {
    const action = permissionName.split(' ')[0];
    const labels: Record<string, string> = {
      view: 'Voir',
      create: 'Créer',
      edit: 'Modifier',
      delete: 'Supprimer',
    };

    return labels[action] || action;
  }

  openAddForm(): void {
    this.editingRole.set(null);
    this.showForm.set(true);
  }

  openEditForm(role: Role): void {
    this.editingRole.set(role);
    this.showForm.set(true);
  }

  closeForm(): void {
    this.showForm.set(false);
    this.editingRole.set(null);
  }







  /** Le formulaire porte désormais son propre état ; la page reçoit le résultat. */
  saveRoleFrom(payload: { name: string; permissions: number[] }): void {
    const editing = this.editingRole();

    if (editing) {
      this.roleService.updateRole(editing.id, payload).subscribe({
        next: () => {
          this.closeForm();
          this.loadData();
        },
      });
    } else {
      this.roleService.createRole(payload).subscribe({
        next: () => {
          this.closeForm();
          this.loadData();
        },
      });
    }
  }

  deleteRole(role: Role): void {
    this.pendingDelete.set({
      title: `Supprimer le rôle « ${role.name} » ?`,
      consequence: `Ses ${role.permissions.length} permission(s) seront retirées aux utilisateurs qui le portent.`,
      run: () => {
        this.roleService.deleteRole(role.id).subscribe({
          next: () => this.loadData(),
        });
      },
    });
  }

  openPermissionForm(): void {
    this.showPermissionForm.set(true);
  }

  closePermissionForm(): void {
    this.showPermissionForm.set(false);
  }

  addPermissionNamed(name: string): void {
    this.roleService.createPermission(name).subscribe({
      next: () => {
        this.closePermissionForm();
        this.loadData();
      },
    });
  }

  deletePermission(perm: Permission): void {
    this.pendingDelete.set({
      title: `Supprimer la permission « ${perm.name} » ?`,
      consequence: 'Elle disparaît de tous les rôles qui la portent, et les écrans correspondants deviennent inaccessibles.',
      run: () => {
        this.roleService.deletePermission(perm.id).subscribe({
          next: () => this.loadData(),
        });
      },
    });
  }
}