import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CarrierService } from '../../core/services/carrier.service';
import { AuthService } from '../../core/services/auth.service';
import { Carrier, CarrierPayload, PaginatedResponse } from '../../core/models/carrier.model';
import { CarrierFormComponent } from './carrier-form/carrier-form.component';

@Component({
  selector: 'app-carriers',
  standalone: true,
  imports: [CommonModule, FormsModule, CarrierFormComponent],
  templateUrl: './carriers.component.html',
  styleUrls: ['./carriers.component.scss'],
})
export class CarriersComponent implements OnInit {
  carriers = signal<Carrier[]>([]);
  currentPage = signal(1);
  lastPage = signal(1);
  total = signal(0);
  perPage = signal(20);
  filterSearch = signal('');
  loading = signal(false);
  showForm = signal(false);
  editingCarrier = signal<Carrier | null>(null);

  constructor(private service: CarrierService, private authService: AuthService) {}

  ngOnInit(): void { this.loadData(); }

  loadData(): void {
    this.loading.set(true);
    this.service.getCarriers({
      page: this.currentPage().toString(),
      per_page: this.perPage().toString(),
      search: this.filterSearch(),
    }).subscribe({
      next: (res) => {
        const p = res as PaginatedResponse<Carrier>;
        this.carriers.set(p.data);
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
  openAddForm(): void { this.editingCarrier.set(null); this.showForm.set(true); }
  openEditForm(c: Carrier): void { this.editingCarrier.set(c); this.showForm.set(true); }
  closeForm(): void { this.showForm.set(false); this.editingCarrier.set(null); }

  onFormSubmit(payload: CarrierPayload): void {
    const editing = this.editingCarrier();
    const obs = editing
      ? this.service.updateCarrier(editing.id, payload)
      : this.service.createCarrier(payload);
    obs.subscribe({ next: () => { this.closeForm(); this.loadData(); } });
  }

  deleteCarrier(c: Carrier): void {
    if (confirm(`Supprimer le transporteur "${c.name}" ?`)) {
      this.service.deleteCarrier(c.id).subscribe({ next: () => this.loadData() });
    }
  }

  logout(): void { this.authService.logout(); }

  get pages(): number[] {
    const total = this.lastPage(), current = this.currentPage(), pages: number[] = [];
    for (let i = Math.max(1, current - 2); i <= Math.min(total, current + 2); i++) pages.push(i);
    return pages;
  }
}
