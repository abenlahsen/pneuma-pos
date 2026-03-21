import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PartnerService } from '../../core/services/partner.service';
import { AuthService } from '../../core/services/auth.service';
import { Partner, PartnerPayload, PaginatedResponse } from '../../core/models/partner.model';
import { PartnerFormComponent } from './partner-form/partner-form.component';

@Component({
  selector: 'app-partners',
  standalone: true,
  imports: [CommonModule, FormsModule, PartnerFormComponent],
  templateUrl: './partners.component.html',
  styleUrl: './partners.component.scss',
})
export class PartnersComponent implements OnInit {
  partners = signal<Partner[]>([]);
  currentPage = signal(1);
  lastPage = signal(1);
  total = signal(0);
  perPage = signal(20);
  filterSearch = signal('');
  loading = signal(false);
  showForm = signal(false);
  editingPartner = signal<Partner | null>(null);

  constructor(private service: PartnerService, private authService: AuthService) {}

  ngOnInit(): void { this.loadData(); }

  loadData(): void {
    this.loading.set(true);
    this.service.getPartners({
      page: this.currentPage().toString(),
      per_page: this.perPage().toString(),
      search: this.filterSearch(),
    }).subscribe({
      next: (res) => {
        const p = res as PaginatedResponse<Partner>;
        this.partners.set(p.data);
        this.currentPage.set(p.current_page);
        this.lastPage.set(p.last_page);
        this.total.set(p.total);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  applyFilters(): void { this.currentPage.set(1); this.loadData(); }
  resetFilters(): void { this.filterSearch.set(''); this.currentPage.set(1); this.loadData(); }
  goToPage(page: number): void { if (page >= 1 && page <= this.lastPage()) { this.currentPage.set(page); this.loadData(); } }
  openAddForm(): void { this.editingPartner.set(null); this.showForm.set(true); }
  openEditForm(p: Partner): void { this.editingPartner.set(p); this.showForm.set(true); }
  closeForm(): void { this.showForm.set(false); this.editingPartner.set(null); }

  onFormSubmit(payload: PartnerPayload): void {
    const editing = this.editingPartner();
    const obs = editing
      ? this.service.updatePartner(editing.id, payload)
      : this.service.createPartner(payload);
    obs.subscribe({ next: () => { this.closeForm(); this.loadData(); } });
  }

  deletePartner(p: Partner): void {
    if (confirm(`Supprimer le partenaire "${p.name}" ?`)) {
      this.service.deletePartner(p.id).subscribe({ next: () => this.loadData() });
    }
  }

  logout(): void { this.authService.logout(); }

  get pages(): number[] {
    const total = this.lastPage(), current = this.currentPage(), pages: number[] = [];
    for (let i = Math.max(1, current - 2); i <= Math.min(total, current + 2); i++) pages.push(i);
    return pages;
  }
}
