import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService } from '../../core/services/user.service';
import { RoleService } from '../../core/services/role.service';
import { AuthService } from '../../core/services/auth.service';
import { ManagedUser, UserPayload, PaginatedResponse } from '../../core/models/user-manage.model';
import { Role } from '../../core/models/role.model';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './users.component.html',
  styleUrls: ['../sales/sales.component.scss', './users.component.scss'],
})
export class UsersComponent implements OnInit {
  users = signal<ManagedUser[]>([]);
  roles = signal<Role[]>([]);
  loading = signal(false);

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
  formRole = signal('');

  constructor(
    private userService: UserService,
    private roleService: RoleService,
    public authService: AuthService,
  ) {}

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
      },
      error: () => this.loading.set(false),
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
    const payload: any = {
      name: this.formName(),
      email: this.formEmail(),
      phone: this.formPhone() || undefined,
      commission_rate: this.formCommissionRate() ?? undefined,
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
    if (confirm(`Voulez-vous vraiment supprimer l'utilisateur "${user.name}" ?`)) {
      this.userService.deleteUser(user.id).subscribe({
        next: () => this.loadData(),
      });
    }
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
