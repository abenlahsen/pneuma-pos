import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { DashboardService } from '../../core/services/dashboard.service';
import { User } from '../../core/models/auth.model';
import { DashboardKpi } from '../../core/models/dashboard-kpi.model';

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

  constructor(
    public authService: AuthService,
    private dashboardService: DashboardService,
  ) {}

  ngOnInit(): void {
    this.authService.fetchUser().subscribe({
      next: (response) => this.user.set(response.user),
    });

    if (this.authService.hasRole('Administrator')) {
      this.dashboardService.getKpi().subscribe({
        next: (kpi) => this.kpi.set(kpi),
      });
    }
  }

  logout(): void {
    this.authService.logout();
  }
}
