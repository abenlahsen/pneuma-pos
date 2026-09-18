import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { DashboardService } from '../../core/services/dashboard.service';
import { User } from '../../core/models/auth.model';
import { DashboardKpi } from '../../core/models/dashboard-kpi.model';
import { DashboardTodo } from '../../core/models/dashboard-todo.model';
import { AutoRefreshControlComponent } from '../../shared/auto-refresh-control/auto-refresh-control.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, AutoRefreshControlComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  readonly user = signal<User | null>(null);
  readonly kpi = signal<DashboardKpi | null>(null);

  // ── Refonte 2b : la liste « à traiter » ────────────────────────────────────
  readonly todo = signal<DashboardTodo | null>(null);
  readonly loadingTodo = signal(false);
  readonly todoTab = signal<'tout' | 'impayes' | 'achats' | 'facturer' | 'stock'>('tout');

  readonly today = new Date();

  readonly todoCount = computed(() => {
    const t = this.todo();
    if (!t) return 0;
    return (t.unpaid_sales?.count ?? 0)
      + (t.unpaid_purchases?.count ?? 0)
      + (t.to_invoice?.count ?? 0)
      + (t.low_stock?.count ?? 0);
  });

  /** Ce que pèsent les lignes à traiter, hors stock : une rupture n'a pas de montant dû. */
  readonly todoTotal = computed(() => {
    const t = this.todo();
    if (!t) return 0;
    return (t.unpaid_sales?.total ?? 0)
      + (t.unpaid_purchases?.total ?? 0)
      + (t.to_invoice?.total ?? 0);
  });

  readonly showsGroup = computed(() => {
    const tab = this.todoTab();
    return {
      impayes: tab === 'tout' || tab === 'impayes',
      achats: tab === 'tout' || tab === 'achats',
      facturer: tab === 'tout' || tab === 'facturer',
      stock: tab === 'tout' || tab === 'stock',
    };
  });

  /**
   * Histogramme 30 jours. Le tableau arrive complet (les jours sans vente
   * valent 0), donc la moyenne porte bien sur 30 jours et pas sur les seuls
   * jours travaillés.
   */
  readonly salesChart = computed(() => {
    const days = this.todo()?.sales_last_30_days ?? [];
    if (!days.length) {
      return {
        bars: [] as { date: string; amount: number; height: number; isToday: boolean }[],
        average: 0,
        todayDelta: null as number | null,
      };
    }

    const max = Math.max(1, ...days.map((d) => d.amount));
    const average = days.reduce((sum, d) => sum + d.amount, 0) / days.length;
    const todayAmount = days[days.length - 1]?.amount ?? 0;

    return {
      bars: days.map((d, index) => ({
        date: d.date,
        amount: d.amount,
        height: Math.max(2, (d.amount / max) * 100),
        isToday: index === days.length - 1,
      })),
      average,
      todayDelta: average > 0 ? ((todayAmount - average) / average) * 100 : null,
    };
  });

  constructor(
    public authService: AuthService,
    private dashboardService: DashboardService,
  ) {}

  ngOnInit(): void {
    this.user.set(this.authService.user());
    this.refreshTodo();
    this.refreshKpi();
  }

  refreshTodo(): void {
    this.loadingTodo.set(true);
    this.dashboardService.getTodo().subscribe({
      next: (todo) => {
        this.todo.set(todo);
        this.loadingTodo.set(false);
      },
      error: () => this.loadingTodo.set(false),
    });
  }

  /**
   * Refonte 2b : l'Accueil ne porte plus de sélecteurs de période. C'est un
   * écran du jour ; l'analyse par mois ou par année vit dans Reporting et dans
   * l'historique KPI. Les KPI sont donc demandés sur la date courante, valeur
   * par défaut de l'endpoint.
   */
  refreshKpi(): void {
    if (!this.authService.hasRole('Administrator')) {
      return;
    }

    this.dashboardService.getKpi().subscribe({
      next: (kpi) => this.kpi.set(kpi),
    });
  }
}
