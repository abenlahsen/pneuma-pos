import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RoleService } from '../data-access/role.service';
import { AuthService } from '../../../core/services/auth.service';
import { Permission, Role } from '../models/role.model';
import { AutoRefreshControlComponent } from '../../../shared/auto-refresh-control/auto-refresh-control.component';
import { IconComponent } from '../../../shared/icon/icon.component';

import { describeActiveFilters } from '../../../core/utils/active-filters';
import { EmptyStateComponent } from '../../../shared/empty-state/empty-state.component';
import { TableSkeletonComponent } from '../../../shared/table-skeleton/table-skeleton.component';
import { ErrorBannerComponent, formatErrorDetail } from '../../../shared/error-banner/error-banner.component';

@Component({
  selector: 'app-roles-page',
  standalone: true,
  imports: [IconComponent, CommonModule, FormsModule, AutoRefreshControlComponent, EmptyStateComponent, TableSkeletonComponent, ErrorBannerComponent],
  templateUrl: './roles-page.component.html',
  styleUrls: ['./roles-page.component.scss'],
})
export class RolesPageComponent implements OnInit {
  roles = signal<Role[]>([]);
  permissions = signal<Permission[]>([]);
  loading = signal(false);
  /** Détail technique de la dernière erreur de chargement, '' si tout va bien (`3d`). */
  loadError = signal('');

  showForm = signal(false);
  editingRole = signal<Role | null>(null);
  formName = signal('');
  formPermissions = signal<Set<number>>(new Set());

  showPermissionForm = signal(false);
  newPermissionName = signal('');

  groupedPermissions = signal<Map<string, Permission[]>>(new Map());

  constructor(
    private roleService: RoleService,
    public authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  readonly activeFilterSummary = computed(() => '');

  readonly hasActiveFilters = computed(() => this.activeFilterSummary() !== '');

  readonly emptyStateMessage = computed(() => "Aucun élément n'a encore été enregistré ici.");

  loadData(): void {
    this.loadError.set('');
    this.loading.set(true);
    this.roleService.getRoles({ all: true }).subscribe({
      next: (roles) => {
        this.roles.set(roles as Role[]);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.loadError.set(formatErrorDetail('GET', err?.url ?? '/api/roles', err?.status ?? 0));
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
    this.formName.set('');
    this.formPermissions.set(new Set());
    this.showForm.set(true);
  }

  openEditForm(role: Role): void {
    this.editingRole.set(role);
    this.formName.set(role.name);
    this.formPermissions.set(new Set(role.permissions.map((permission) => permission.id)));
    this.showForm.set(true);
  }

  closeForm(): void {
    this.showForm.set(false);
    this.editingRole.set(null);
  }

  togglePermission(permId: number): void {
    const current = new Set(this.formPermissions());

    if (current.has(permId)) {
      current.delete(permId);
    } else {
      current.add(permId);
    }

    this.formPermissions.set(current);
  }

  hasPermission(permId: number): boolean {
    return this.formPermissions().has(permId);
  }

  toggleAllForResource(resource: string): void {
    const resourcePerms = this.groupedPermissions().get(resource) || [];
    const current = new Set(this.formPermissions());
    const allSelected = resourcePerms.every((permission) => current.has(permission.id));

    for (const perm of resourcePerms) {
      if (allSelected) {
        current.delete(perm.id);
      } else {
        current.add(perm.id);
      }
    }

    this.formPermissions.set(current);
  }

  isAllSelectedForResource(resource: string): boolean {
    const resourcePerms = this.groupedPermissions().get(resource) || [];
    return resourcePerms.length > 0 && resourcePerms.every((permission) => this.formPermissions().has(permission.id));
  }

  selectAll(): void {
    const allIds = this.permissions().map((permission) => permission.id);
    this.formPermissions.set(new Set(allIds));
  }

  deselectAll(): void {
    this.formPermissions.set(new Set());
  }

  saveRole(): void {
    const payload = {
      name: this.formName(),
      permissions: Array.from(this.formPermissions()),
    };

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
    if (confirm(`Voulez-vous vraiment supprimer le rôle "${role.name}" ?`)) {
      this.roleService.deleteRole(role.id).subscribe({
        next: () => this.loadData(),
      });
    }
  }

  openPermissionForm(): void {
    this.newPermissionName.set('');
    this.showPermissionForm.set(true);
  }

  closePermissionForm(): void {
    this.showPermissionForm.set(false);
  }

  addPermission(): void {
    const name = this.newPermissionName().trim();

    if (!name) {
      return;
    }

    this.roleService.createPermission(name).subscribe({
      next: () => {
        this.closePermissionForm();
        this.loadData();
      },
    });
  }

  deletePermission(perm: Permission): void {
    if (confirm(`Voulez-vous vraiment supprimer la permission "${perm.name}" ?`)) {
      this.roleService.deletePermission(perm.id).subscribe({
        next: () => this.loadData(),
      });
    }
  }
}