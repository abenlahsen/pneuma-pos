import { Component, DestroyRef, OnInit, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { switchMap, timer } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { DashboardService } from '../../core/services/dashboard.service';
import { User } from '../../core/models/auth.model';
import { DashboardKpi } from '../../core/models/dashboard-kpi.model';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  user = signal<User | null>(null);
  kpi = signal<DashboardKpi | null>(null);
  loadingKpi = signal(false);

  private readonly now = new Date();
  selectedDay = signal(this.formatDay(this.now));
  selectedMonth = signal(this.formatMonth(this.now));
  selectedYear = signal(String(this.now.getFullYear()));
  yearOptions = computed(() => {
    const currentYear = this.now.getFullYear();
    const years: string[] = [];

    for (let year = currentYear - 5; year <= currentYear + 2; year++) {
      years.push(String(year));
    }

    return years;
  });

  private destroyRef = inject(DestroyRef);

  constructor(
    public authService: AuthService,
    private dashboardService: DashboardService,
  ) {
    effect(() => {
      if (!this.authService.hasRole('Administrator')) {
        return;
      }

      this.selectedDay();
      this.selectedMonth();
      this.selectedYear();

      this.refreshKpi();
    });
  }

  ngOnInit(): void {
    this.user.set(this.authService.user());

    if (this.authService.hasRole('Administrator')) {
      timer(environment.dashboardRefreshIntervalMs, environment.dashboardRefreshIntervalMs)
        .pipe(
          switchMap(() => this.dashboardService.getKpi({
            day: this.selectedDay(),
            month: this.selectedMonth(),
            year: this.selectedYear(),
          })),
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe({
          next: (kpi) => this.kpi.set(kpi),
        });
    }
  }

  onDayChange(value: string): void {
    if (!value) {
      return;
    }

    this.selectedDay.set(value);
  }

  onMonthChange(value: string): void {
    if (!value) {
      return;
    }

    this.selectedMonth.set(value);
  }

  onYearChange(value: string): void {
    if (!value) {
      return;
    }

    this.selectedYear.set(value);
  }

  logout(): void {
    this.authService.logout();
  }

  private refreshKpi(): void {
    this.loadingKpi.set(true);

    this.dashboardService.getKpi({
      day: this.selectedDay(),
      month: this.selectedMonth(),
      year: this.selectedYear(),
    }).subscribe({
      next: (kpi) => {
        this.kpi.set(kpi);
        this.loadingKpi.set(false);
      },
      error: () => this.loadingKpi.set(false),
    });
  }

  private formatDay(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private formatMonth(date: Date): string {
    return date.toISOString().slice(0, 7);
  }
}
