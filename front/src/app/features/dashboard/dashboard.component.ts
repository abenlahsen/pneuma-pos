import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { DashboardService } from '../../core/services/dashboard.service';
import { User } from '../../core/models/auth.model';
import { QueueScope, WorkQueues } from '../../core/models/work-queue.model';
import { AutoRefreshControlComponent } from '../../shared/auto-refresh-control/auto-refresh-control.component';
import { IconComponent } from '../../shared/icon/icon.component';
import { EmptyStateComponent } from '../../shared/empty-state/empty-state.component';
import { ErrorBannerComponent, formatErrorDetail } from '../../shared/error-banner/error-banner.component';

/**
 * Accueil (`5a`/`5b`) — une liste de travail, pas un tableau de chiffres.
 *
 * Une seule route et un seul composant : le jeu de files et leur portee
 * viennent du serveur, qui filtre les donnees. Le front n'a rien a masquer,
 * et donc rien a laisser fuir.
 */
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [IconComponent, CommonModule, AutoRefreshControlComponent, EmptyStateComponent, ErrorBannerComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly dashboardService = inject(DashboardService);
  readonly authService = inject(AuthService);

  readonly user = signal<User | null>(null);
  readonly queues = signal<WorkQueues>({});
  readonly loading = signal(false);
  readonly loadError = signal('');

  /** Total de lignes en attente, toutes files confondues. */
  readonly pendingTotal = computed(() => {
    const q = this.queues();
    return (q.unpaid?.count ?? 0) + (q.to_invoice?.count ?? 0);
  });

  readonly hasAnyQueue = computed(() => {
    const q = this.queues();
    return !!q.unpaid || !!q.to_invoice;
  });

  ngOnInit(): void {
    this.user.set(this.authService.user());
    this.loadQueues();
  }

  loadQueues(): void {
    this.loading.set(true);
    this.loadError.set('');

    this.dashboardService.getWorkQueues().subscribe({
      next: (queues) => {
        this.queues.set(queues);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.loadError.set(formatErrorDetail('GET', err?.url ?? '/api/work-queues', err?.status ?? 0));
      },
    });
  }

  /** « Agence · partagé » quand la file couvre tout le monde, sinon « Mes lignes ». */
  scopeLabel(scope: QueueScope | undefined): string {
    return scope === 'all' ? 'Toute l’agence' : 'Mes lignes';
  }

  /** Un impayé se règle sur la vente : on ouvre la vente, pas une page intermédiaire. */
  openSale(id: number): void {
    this.router.navigate(['/sales'], { queryParams: { id } });
  }

  openServiceOrder(id: number): void {
    this.router.navigate(['/service-orders'], { queryParams: { id } });
  }

  /** Une ligne en retard se lit au premier coup d'œil. */
  isOverdue(date: string | null | undefined, days = 30): boolean {
    if (!date) return false;

    const when = new Date(date).getTime();
    if (Number.isNaN(when)) return false;

    return (Date.now() - when) / 86_400_000 > days;
  }
}
