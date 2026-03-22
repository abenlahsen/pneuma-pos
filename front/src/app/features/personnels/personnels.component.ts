import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Personnel, PersonnelPayload, PaginatedResponse } from '../../core/models/personnel.model';
import { PersonnelService } from '../../core/services/personnel.service';
import { PersonnelFormComponent } from './personnel-form/personnel-form.component';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-personnels',
  standalone: true,
  imports: [CommonModule, FormsModule, PersonnelFormComponent],
  templateUrl: './personnels.component.html',
  styleUrls: ['./personnels.component.scss']
})
export class PersonnelsComponent implements OnInit {
  personnels = signal<Personnel[]>([]);
  currentPage = signal(1);
  lastPage = signal(1);
  total = signal(0);
  perPage = signal(20);
  filterSearch = signal(''); // Renamed from filterSearch to searchQuery in the provided snippet, but keeping filterSearch as it's used consistently in the original and the new snippet's resetFilters.
  loading = signal(false);
  isFormOpen = signal(false); // Renamed from showForm
  selectedPersonnel = signal<Personnel | null>(null);

  constructor(private personnelService: PersonnelService, private authService: AuthService) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    const params = {
      page: this.currentPage().toString(),
      per_page: this.perPage().toString(),
      search: this.filterSearch(), // Using filterSearch as it's consistent with resetFilters
    };

    this.personnelService.getPersonnels(params).subscribe({ // New service method
      next: (res) => {
        const p = res as PaginatedResponse<Personnel>; // Corrected type casting
        this.personnels.set(p.data); // Renamed reps to personnels
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
  goToPage(page: number): void {
    if (page >= 1 && page <= this.lastPage()) {
      this.currentPage.set(page);
      this.loadData();
    }
  }

  openForm(personnel?: Personnel): void { // Combined openAddForm and openEditForm
    this.selectedPersonnel.set(personnel || null);
    this.isFormOpen.set(true);
  }

  closeForm(): void {
    this.isFormOpen.set(false);
    this.selectedPersonnel.set(null);
  }

  onFormSaved(payload: PersonnelPayload): void { // Renamed from onFormSubmit, added payload for consistency
    const editing = this.selectedPersonnel();
    const obs = editing
      ? this.personnelService.updatePersonnel(editing.id, payload) // New service method
      : this.personnelService.createPersonnel(payload); // New service method
    obs.subscribe({ next: () => { this.closeForm(); this.loadData(); } });
  }

  deletePersonnel(personnel: Personnel): void {
    if (confirm(`Supprimer le personnel "${personnel.name}" ?`)) {
      this.personnelService.deletePersonnel(personnel.id).subscribe({ next: () => this.loadData() });
    }
  }

  logout(): void { this.authService.logout(); }

  get pages(): number[] {
    const total = this.lastPage(), current = this.currentPage(), pages: number[] = [];
    for (let i = Math.max(1, current - 2); i <= Math.min(total, current + 2); i++) pages.push(i);
    return pages;
  }
}
