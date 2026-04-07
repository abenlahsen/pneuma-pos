import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RoleService } from '../../core/services/role.service';
import { AuthService } from '../../core/services/auth.service';
import { Role, Permission } from '../../core/models/role.model';

@Component({
  selector: 'app-roles',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './roles.component.html',
  styleUrls: ['../sales/sales.component.scss', './roles.component.scss'],
})
export class RolesComponent implements OnInit {
  roles = signal<Role[]>([]);
  permissions = signal<Permission[]>([]);
  loading = signal(false);

  // Form state
  showForm = signal(false);
  editingRole = signal<Role | null>(null);
  formName = signal('');
  formPermissions = signal<Set<number>>(new Set());

  // Permission form
  showPermissionForm = signal(false);
  newPermissionName = signal('');

  // Group permissions by resource
  groupedPermissions = signal<Map<string, Permission[]>>(new Map());

  constructor(private roleService: RoleService, public authService: AuthService) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    this.roleService.getRoles({ all: true }).subscribe({
      next: (roles) => {
        this.roles.set(roles as Role[]);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
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
      'sales': 'Ventes',
      'purchases': 'Achats',
      'suppliers': 'Fournisseurs',
      'carriers': 'Transporteurs',
      'partners': 'Partenaires',
      'cash-flow': 'Cash Flow',
      'users': 'Utilisateurs',
      'roles': 'Rôles',
    };
    return labels[resource] || resource;
  }

  getActionLabel(permissionName: string): string {
    const action = permissionName.split(' ')[0];
    const labels: Record<string, string> = {
      'view': 'Voir',
      'create': 'Créer',
      'edit': 'Modifier',
      'delete': 'Supprimer',
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
    this.formPermissions.set(new Set(role.permissions.map(p => p.id)));
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
    const allSelected = resourcePerms.every(p => current.has(p.id));

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
    return resourcePerms.length > 0 && resourcePerms.every(p => this.formPermissions().has(p.id));
  }

  selectAll(): void {
    const allIds = this.permissions().map(p => p.id);
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

  // Permission management
  openPermissionForm(): void {
    this.newPermissionName.set('');
    this.showPermissionForm.set(true);
  }

  closePermissionForm(): void {
    this.showPermissionForm.set(false);
  }

  addPermission(): void {
    const name = this.newPermissionName().trim();
    if (!name) return;
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
