import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PrimeService } from '../data-access/prime.service';
import { PrimesResponse } from '../models/prime.model';

const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

@Component({
  selector: 'app-primes-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './primes-page.component.html',
  styleUrls: ['./primes-page.component.scss'],
})
export class PrimesPageComponent implements OnInit {
  response = signal<PrimesResponse | null>(null);
  loading = signal(false);

  selectedYear = signal(new Date().getFullYear());
  selectedMonth = signal(new Date().getMonth() + 1);

  readonly now = new Date();
  readonly currentYear = this.now.getFullYear();
  readonly currentMonth = this.now.getMonth() + 1;

  monthLabel = computed(() => `${MONTH_NAMES[this.selectedMonth() - 1]} ${this.selectedYear()}`);

  isCurrentMonth = computed(
    () => this.selectedYear() === this.currentYear && this.selectedMonth() === this.currentMonth,
  );

  constructor(private primeService: PrimeService) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    this.primeService.getPrimes(this.selectedYear(), this.selectedMonth()).subscribe({
      next: (res) => {
        this.response.set(res);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  prevMonth(): void {
    if (this.selectedMonth() === 1) {
      this.selectedMonth.set(12);
      this.selectedYear.update(y => y - 1);
    } else {
      this.selectedMonth.update(m => m - 1);
    }
    this.loadData();
  }

  nextMonth(): void {
    if (this.isCurrentMonth()) return;
    if (this.selectedMonth() === 12) {
      this.selectedMonth.set(1);
      this.selectedYear.update(y => y + 1);
    } else {
      this.selectedMonth.update(m => m + 1);
    }
    this.loadData();
  }

  formatAmount(value: number): string {
    return value.toLocaleString('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}
