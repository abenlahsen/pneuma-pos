import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PartnerService } from '../data-access/partner.service';
import { AuthService } from '../../../core/services/auth.service';
import { Partner, PartnerPayload, PaginatedResponse } from '../models/partner.model';
import { PartnerFormComponent } from '../components/partner-form/partner-form.component';

@Component({
  selector: 'app-partners-page',
  standalone: true,
  imports: [CommonModule, FormsModule, PartnerFormComponent],
  templateUrl: './partners-page.component.html',
  styleUrls: ['./partners-page.component.scss'],
})
export class PartnersPageComponent implements OnInit {
  partners = signal<Partner[]>([]);
  currentPage = signal(1);
  lastPage = signal(1);
  total = signal(0);
  perPage = signal(100);
  filterSearch = signal('');
  sortBy = signal('');
  sortDirection = signal<'asc' | 'desc'>('asc');
  loading = signal(false);
  showForm = signal(false);
  editingPartner = signal<Partner | null>(null);

  constructor(private service: PartnerService, public authService: AuthService) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    const page = Number(this.currentPage() ?? 1) || 1;
    const perPage = Number(this.perPage() ?? 100) || 100;

    this.service
      .getPartners({
        page: page.toString(),
        per_page: perPage.toString(),
        search: this.filterSearch(),
        sort_by: this.sortBy(),
        sort_direction: this.sortDirection(),
      })
      .subscribe({
        next: (res) => {
          const p = res as PaginatedResponse<Partner>;
          this.partners.set(p.data);
          this.currentPage.set(Number(p.current_page ?? 1) || 1);
          this.lastPage.set(Number(p.last_page ?? 1) || 1);
          this.total.set(Number(p.total ?? 0) || 0);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  applyFilters(): void {
    this.currentPage.set(1);
    this.loadData();
  }

  toggleSort(column: string): void {
    if (this.sortBy() === column) {
      this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortBy.set(column);
      this.sortDirection.set('asc');
    }
    this.currentPage.set(1);
    this.loadData();
  }

  resetFilters(): void {
    this.filterSearch.set('');
    this.sortBy.set('');
    this.sortDirection.set('asc');
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
    this.editingPartner.set(null);
    this.showForm.set(true);
  }

  openEditForm(p: Partner): void {
    this.editingPartner.set(p);
    this.showForm.set(true);
  }

  closeForm(): void {
    this.showForm.set(false);
    this.editingPartner.set(null);
  }

  onFormSubmit(payload: PartnerPayload): void {
    const editing = this.editingPartner();
    const obs = editing ? this.service.updatePartner(editing.id, payload) : this.service.createPartner(payload);
    obs.subscribe({
      next: () => {
        this.closeForm();
        this.loadData();
      },
    });
  }

  deletePartner(p: Partner): void {
    if (confirm(`Supprimer le partenaire "${p.name}" ?`)) {
      this.service.deletePartner(p.id).subscribe({ next: () => this.loadData() });
    }
  }

  logout(): void {
    this.authService.logout();
  }

  get pages(): number[] {
    const total = this.lastPage();
    const current = this.currentPage();
    const pages: number[] = [];
    for (let i = Math.max(1, current - 2); i <= Math.min(total, current + 2); i++) {
      pages.push(i);
    }
    return pages;
  }
}
