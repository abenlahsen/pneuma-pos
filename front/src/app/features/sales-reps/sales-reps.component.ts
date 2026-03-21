import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SalesRepService } from '../../core/services/sales-rep.service';
import { AuthService } from '../../core/services/auth.service';
import { SalesRep, SalesRepPayload, PaginatedResponse } from '../../core/models/sales-rep.model';
import { SalesRepFormComponent } from './sales-rep-form/sales-rep-form.component';

@Component({
  selector: 'app-sales-reps',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, SalesRepFormComponent],
  templateUrl: './sales-reps.component.html',
  styleUrl: './sales-reps.component.scss',
})
export class SalesRepsComponent implements OnInit {
  reps = signal<SalesRep[]>([]);
  currentPage = signal(1);
  lastPage = signal(1);
  total = signal(0);
  perPage = signal(20);
  filterSearch = signal('');
  loading = signal(false);
  showForm = signal(false);
  editingRep = signal<SalesRep | null>(null);

  constructor(private service: SalesRepService, private authService: AuthService) {}

  ngOnInit(): void { this.loadData(); }

  loadData(): void {
    this.loading.set(true);
    this.service.getSalesReps({
      page: this.currentPage().toString(),
      per_page: this.perPage().toString(),
      search: this.filterSearch(),
    }).subscribe({
      next: (res) => {
        const p = res as PaginatedResponse<SalesRep>;
        this.reps.set(p.data);
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
  openAddForm(): void { this.editingRep.set(null); this.showForm.set(true); }
  openEditForm(rep: SalesRep): void { this.editingRep.set(rep); this.showForm.set(true); }
  closeForm(): void { this.showForm.set(false); this.editingRep.set(null); }

  onFormSubmit(payload: SalesRepPayload): void {
    const editing = this.editingRep();
    const obs = editing
      ? this.service.updateSalesRep(editing.id, payload)
      : this.service.createSalesRep(payload);
    obs.subscribe({ next: () => { this.closeForm(); this.loadData(); } });
  }

  deleteRep(rep: SalesRep): void {
    if (confirm(`Supprimer le commercial "${rep.name}" ?`)) {
      this.service.deleteSalesRep(rep.id).subscribe({ next: () => this.loadData() });
    }
  }

  logout(): void { this.authService.logout(); }

  get pages(): number[] {
    const total = this.lastPage(), current = this.currentPage(), pages: number[] = [];
    for (let i = Math.max(1, current - 2); i <= Math.min(total, current + 2); i++) pages.push(i);
    return pages;
  }
}
