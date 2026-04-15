import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
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

  private destroyRef = inject(DestroyRef);

  constructor(
    public authService: AuthService,
    private dashboardService: DashboardService,
  ) {}

  ngOnInit(): void {
    this.authService.fetchUser().subscribe({
      next: (response) => this.user.set(response.user),
    });

    if (this.authService.hasRole('Administrator')) {
      timer(0, environment.dashboardRefreshIntervalMs)
        .pipe(
          switchMap(() => this.dashboardService.getKpi()),
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe({
          next: (kpi) => this.kpi.set(kpi),
        });
    }
  }

  logout(): void {
    this.authService.logout();
  }
}
