import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HrChargeService } from '../data-access/hr-charge.service';
import { HrChargeFormComponent } from '../components/hr-charge-form/hr-charge-form.component';
import { HrCharge, HrChargeBatchPayload, HrChargeFilters, HrChargeSummary } from '../models/hr-charge.model';
import { AuthService } from '../../../core/services/auth.service';

const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

@Component({
  selector: 'app-hr-charges-page',
  standalone: true,
  imports: [CommonModule, FormsModule, HrChargeFormComponent],
  templateUrl: './hr-charges-page.component.html',
  styleUrl: './hr-charges-page.component.scss',
})
export class HrChargesPageComponent implements OnInit {
  charges = signal<HrCharge[]>([]);
  summary = signal<HrChargeSummary | null>(null);
  filters = signal<HrChargeFilters>({ employees: [], subcategories: [], accounts: [] });
  loading = signal(false);
  errorMessage = signal('');

  showForm = signal(false);
  editingId = signal<number | null>(null);

  filterEmployeeId = signal<number | null>(null);
  filterSubcategory = signal('');

  selectedYear = signal(new Date().getFullYear());
  selectedMonth = signal(new Date().getMonth() + 1);

  readonly now = new Date();
  readonly currentYear = this.now.getFullYear();
  readonly currentMonth = this.now.getMonth() + 1;

  monthLabel = computed(() => `${MONTH_NAMES[this.selectedMonth() - 1]} ${this.selectedYear()}`);
  isCurrentMonth = computed(
    () => this.selectedYear() === this.currentYear && this.selectedMonth() === this.currentMonth,
  );

  subcategoryTotals = computed(() => {
    const bySub = this.summary()?.by_subcategory || {};
    return Object.entries(bySub).map(([name, amount]) => ({ name, amount }));
  });

  defaultDate = computed(() => {
    if (this.isCurrentMonth()) return this.now.toISOString().slice(0, 10);
    return `${this.selectedYear()}-${String(this.selectedMonth()).padStart(2, '0')}-01`;
  });

  constructor(
    private hrChargeService: HrChargeService,
    public authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.hrChargeService.filters().subscribe({ next: (f) => this.filters.set(f) });
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    const year = this.selectedYear();
    const month = this.selectedMonth();
    const employeeId = this.filterEmployeeId();
    const subcategory = this.filterSubcategory() || null;

    this.hrChargeService.list(year, month, employeeId, subcategory).subscribe({
      next: (res) => {
        this.charges.set(res.data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });

    this.hrChargeService.summary(year, month, employeeId, subcategory).subscribe({
      next: (res) => this.summary.set(res),
    });
  }

  prevMonth(): void {
    if (this.selectedMonth() === 1) {
      this.selectedMonth.set(12);
      this.selectedYear.update((y) => y - 1);
    } else {
      this.selectedMonth.update((m) => m - 1);
    }
    this.loadData();
  }

  nextMonth(): void {
    if (this.isCurrentMonth()) return;
    if (this.selectedMonth() === 12) {
      this.selectedMonth.set(1);
      this.selectedYear.update((y) => y + 1);
    } else {
      this.selectedMonth.update((m) => m + 1);
    }
    this.loadData();
  }

  applyFilters(): void {
    this.loadData();
  }

  openForm(): void {
    this.showForm.set(true);
  }

  closeForm(): void {
    this.showForm.set(false);
  }

  submitBatch(payload: HrChargeBatchPayload): void {
    this.hrChargeService.createBatch(payload).subscribe({
      next: () => {
        this.closeForm();
        this.loadData();
      },
      error: (err) => this.showError(err),
    });
  }

  deleteCharge(charge: HrCharge): void {
    if (!confirm(`Supprimer la ligne « ${charge.subcategory} — ${charge.employee_name} » ?`)) return;

    this.hrChargeService.delete(charge.id).subscribe({
      next: () => this.loadData(),
      error: (err) => this.showError(err),
    });
  }

  formatAmount(value: number): string {
    return (value || 0).toLocaleString('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  private showError(err: any): void {
    const msg = err?.error?.message || err?.error?.errors?.lines?.[0] || 'Une erreur est survenue.';
    this.errorMessage.set(msg);
    setTimeout(() => this.errorMessage.set(''), 5000);
  }
}
