import { computed, Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../../../shared/icon/icon.component';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { UserService } from '../data-access/user.service';
import { ManagedUser, PaginatedResponse, UserPayload } from '../models/user.model';
import { Role } from '../../roles/models/role.model';
import { RoleService } from '../../roles/data-access/role.service';
import { AutoRefreshControlComponent } from '../../../shared/auto-refresh-control/auto-refresh-control.component';
import { ConfirmDeleteComponent } from '../../../shared/confirm-delete/confirm-delete.component';
import { PendingDelete } from '../../../shared/confirm-delete/pending-delete';
import { ReferentialModalComponent } from '../../../shared/referential-modal/referential-modal.component';
import { RowLockComponent } from '../../../shared/list-state';

import {
  ActiveFilter,
  ListEmptyComponent,
  ListErrorComponent,
  SkeletonRowComponent,
  describeLoadError,
} from '../../../shared/list-state';

@Component({
  selector: 'app-users-page',
  standalone: true,
  imports: [CommonModule, FormsModule, AutoRefreshControlComponent, IconComponent, SkeletonRowComponent, ListEmptyComponent, ListErrorComponent, RowLockComponent, ReferentialModalComponent, ConfirmDeleteComponent],
  templateUrl: './users-page.component.html',
  styleUrls: ['./users-page.component.scss'],
})
export class UsersPageComponent implements OnInit {

  // ── Suppression : confirmation 15c au lieu d'un confirm() natif ───────────
  readonly pendingDelete = signal<PendingDelete | null>(null);

  runPendingDelete(reason: string): void {
    const pending = this.pendingDelete();
    this.pendingDelete.set(null);
    pending?.run(reason);
  }
  users = signal<ManagedUser[]>([]);
  roles = signal<Role[]>([]);
  loading = signal(false);

  // ── Refonte 2b, §14c : les quatre états manquants ─────────────────────────
  readonly skeletonRows = [0, 1, 2, 3, 4, 5, 6, 7];
  readonly loadError = signal<string | null>(null);
  readonly loadErrorDetail = signal<string | null>(null);
  readonly lastLoadedAt = signal<Date | null>(null);

  readonly activeFilters = computed<ActiveFilter[]>(() => {
    const applied: ActiveFilter[] = [];
    const drop = (label: string, apply: () => void) => {
      applied.push({
        label,
        clear: () => {
          apply();
          this.currentPage.set(1);
          this.loadData();
        },
      });
    };

    if (this.filterSearch()) drop(`recherche « ${this.filterSearch()} »`, () => this.filterSearch.set(''));

    return applied;
  });

  currentPage = signal(1);
  lastPage = signal(1);
  total = signal(0);
  perPage = signal(20);
  filterSearch = signal('');

  showForm = signal(false);
  editingUser = signal<ManagedUser | null>(null);
  formName = signal('');
  formEmail = signal('');
  formPassword = signal('');
  formPasswordConfirmation = signal('');
  formPhone = signal('');
  formCommissionRate = signal<number | null>(null);
  formPrimePerTyre = signal<number | null>(null);
  formRole = signal('');

  constructor(
    private userService: UserService,
    private roleService: RoleService,
    public authService: AuthService,
  ) {}

  /**
   * Refonte 2b, 9a : ce que les colonnes tombées sous $bp-reduce portaient —
   * téléphone, commission, prime par pneu et date de création. Elles ne
   * disparaissent pas, elles descendent dans la sous-ligne.
   */
  foldedSubLineFor(user: ManagedUser): string {
    const parts: (string | null)[] = [
      user.phone || null,
      user.commission_rate != null ? `commission ${user.commission_rate} %` : null,
      user.prime_per_tyre != null ? `prime ${user.prime_per_tyre} DH/pneu` : null,
      user.created_at ? `créé le ${new Date(user.created_at).toLocaleDateString('fr-FR')}` : null,
    ];
    return parts.filter((p): p is string => !!p).join(' · ');
  }

  /**
   * Le titre de la coque. Calculé ici et non dans la liaison : une apostrophe
   * échappée dans une expression de gabarit n'est pas analysable par Angular.
   */
  formTitle(): string {
    const user = this.editingUser();
    return user ? `Modifier ${user.name || "l'utilisateur"}` : 'Nouvel utilisateur';
  }

  /** En français, zéro prend le singulier : « 1 rôle attribué ». */
  linkedRolesLabel(): string {
    return (this.editingUser()?.roles?.length ?? 0) > 1 ? 'rôles attribués' : 'rôle attribué';
  }

  ngOnInit(): void {
    this.loadData();
    this.loadRoles();
  }

  loadData(): void {
    this.loading.set(true);
    const filters: Record<string, string> = {
      page: this.currentPage().toString(),
      per_page: this.perPage().toString(),
    };

    if (this.filterSearch()) {
      filters['search'] = this.filterSearch();
    }

    this.userService.getUsers(filters).subscribe({
      next: (response) => {
        const paginated = response as PaginatedResponse<ManagedUser>;
        this.users.set(paginated.data);
        this.currentPage.set(paginated.current_page);
        this.lastPage.set(paginated.last_page);
        this.total.set(paginated.total);
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
  }

  loadRoles(): void {
    this.roleService.getRoles({ all: true }).subscribe({
      next: (roles) => this.roles.set(roles as Role[]),
    });
  }

  applyFilters(): void {
    this.currentPage.set(1);
    this.loadData();
  }

  resetFilters(): void {
    this.filterSearch.set('');
    this.currentPage.set(1);
    this.loadData();
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.lastPage()) {
      this.currentPage.set(page);
      this.loadData();
    }
  }

  openAddForm(): void {
    this.editingUser.set(null);
    this.formName.set('');
    this.formEmail.set('');
    this.formPassword.set('');
    this.formPasswordConfirmation.set('');
    this.formPhone.set('');
    this.formCommissionRate.set(null);
    this.formPrimePerTyre.set(null);
    this.formRole.set('');
    this.showForm.set(true);
  }

  openEditForm(user: ManagedUser): void {
    this.editingUser.set(user);
    this.formName.set(user.name);
    this.formEmail.set(user.email);
    this.formPassword.set('');
    this.formPasswordConfirmation.set('');
    this.formPhone.set(user.phone || '');
    this.formCommissionRate.set(user.commission_rate);
    this.formPrimePerTyre.set(user.prime_per_tyre);
    this.formRole.set(user.roles.length > 0 ? user.roles[0].name : '');
    this.showForm.set(true);
  }

  closeForm(): void {
    this.showForm.set(false);
    this.editingUser.set(null);
  }

  passwordsMatch(): boolean {
    return this.formPassword() === this.formPasswordConfirmation();
  }

  saveUser(): void {
    const payload: UserPayload = {
      name: this.formName(),
      email: this.formEmail(),
      phone: this.formPhone() || undefined,
      commission_rate: this.formCommissionRate() ?? undefined,
      prime_per_tyre: this.formPrimePerTyre() ?? undefined,
      role: this.formRole() || undefined,
    };

    if (this.formPassword()) {
      payload.password = this.formPassword();
      payload.password_confirmation = this.formPasswordConfirmation();
    }

    const editing = this.editingUser();

    if (editing) {
      this.userService.updateUser(editing.id, payload).subscribe({
        next: () => {
          this.closeForm();
          this.loadData();
        },
      });
    } else {
      payload.password = this.formPassword();
      this.userService.createUser(payload).subscribe({
        next: () => {
          this.closeForm();
          this.loadData();
        },
      });
    }
  }

  deleteUser(user: ManagedUser): void {
    this.pendingDelete.set({
      title: `Supprimer l'utilisateur « ${user.name} » ?`,
      consequence: 'Les ventes et mouvements qu\'il a saisis gardent son nom : la traçabilité est préservée.',
      run: () => {
        this.userService.deleteUser(user.id).subscribe({
          next: () => this.loadData(),
        });
      },
    });
  }

  get pages(): number[] {
    const total = this.lastPage();
    const current = this.currentPage();
    const pages: number[] = [];
    const start = Math.max(1, current - 2);
    const end = Math.min(total, current + 2);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    return pages;
  }
}