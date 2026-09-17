import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { DashboardService } from '../../core/services/dashboard.service';
import { User } from '../../core/models/auth.model';
import { LowStockRow, PurchaseDueRow, QueueKey, QueueScope, WorkQueues } from '../../core/models/work-queue.model';
import { AutoRefreshControlComponent } from '../../shared/auto-refresh-control/auto-refresh-control.component';
import { IconComponent } from '../../shared/icon/icon.component';
import { EmptyStateComponent } from '../../shared/empty-state/empty-state.component';
import { ErrorBannerComponent, formatErrorDetail } from '../../shared/error-banner/error-banner.component';
import { PageHeaderService } from '../../core/services/page-header.service';
import { todayIso } from '../../core/constants/date.constants';

/** Une barre de la tendance : sa hauteur relative et si c'est aujourd'hui. */
interface TrendBar {
  date: string;
  revenue: number;
  height: number;
  isToday: boolean;
}

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
export class DashboardComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly dashboardService = inject(DashboardService);
  private readonly pageHeader = inject(PageHeaderService);
  readonly authService = inject(AuthService);

  readonly user = signal<User | null>(null);
  readonly queues = signal<WorkQueues>({});
  readonly loading = signal(false);
  readonly loadError = signal('');

  // Repliables : deplie par defaut, comme les 4 autres cartes repliables de
  // l'app. Seules ces deux files le sont — elles seules peuvent depasser la
  // douzaine de lignes affichees et valoir la peine d'etre reduites.
  readonly unpaidCollapsed = signal(false);
  readonly toPayCollapsed = signal(false);

  toggleUnpaid(): void { this.unpaidCollapsed.update((v) => !v); }
  toggleToPay(): void { this.toPayCollapsed.update((v) => !v); }

  /**
   * Total de lignes en attente, toutes files confondues. `to_pay` n'y verse
   * que `legal_count` : un achat fournisseur en retard de quinze jours n'est
   * pas une chose « a traiter aujourd'hui », un risque de penalite legale si.
   */
  readonly pendingTotal = computed(() => {
    const q = this.queues();
    return (q.unpaid?.count ?? 0) + (q.to_invoice?.count ?? 0)
      + (q.to_pay?.legal_count ?? 0) + (q.low_stock?.count ?? 0);
  });

  readonly hasAnyQueue = computed(() => {
    const q = this.queues();
    return !!q.unpaid || !!q.to_invoice || !!q.to_pay || !!q.low_stock;
  });

  // ── Libelles ────────────────────────────────────────────────────────────

  /**
   * Badge de portee. « Mes lignes » etait vague : le possessif doit dire *de
   * quoi* on est proprietaire. Le stock, lui, n'a pas de proprietaire.
   */
  scopeLabel(queue: QueueKey, scope: QueueScope | undefined): string {
    if (queue === 'low_stock' || queue === 'to_pay') return 'Agence · partagé';
    if (scope === 'all') return 'Toutes agences';

    // Le possessif dit de QUOI on est proprietaire : des clients, pour les
    // ventes comme pour les ordres.
    return 'Mes clients';
  }

  /** Titre de file : possessif en portee personnelle, neutre en portee agence. */
  queueTitle(queue: QueueKey, scope: QueueScope | undefined): string {
    const own = scope === 'own';

    if (queue === 'unpaid') return own ? 'Mes impayés' : 'Impayés à relancer';
    if (queue === 'to_invoice') return own ? 'Mes ordres à facturer' : 'Ordres terminés à facturer';
    // Pas de possessif : la dette fournisseur n'appartient a personne en particulier.
    if (queue === 'to_pay') return 'Achats à régler';

    return 'Produits sous seuil';
  }

  /**
   * Le gerant ne fait pas le travail, il le distribue : « Relancer » devient
   * « Assigner » des que la file couvre les lignes de plusieurs personnes.
   */
  actionLabel(queue: QueueKey, scope: QueueScope | undefined): string {
    if (queue === 'to_invoice') return 'Facturer';
    if (queue === 'to_pay') return 'Régler';
    if (queue === 'low_stock') return 'Commander';

    return scope === 'all' ? 'Assigner' : 'Relancer';
  }

  /** Seule « Facturer » conclut une operation : elle seule porte le bouton plein. */
  isPrimaryAction(queue: QueueKey): boolean {
    return queue === 'to_invoice';
  }

  // ── Colonne laterale (5a/5b) ────────────────────────────────────────────

  readonly figures = computed(() => this.queues().figures ?? null);

  /** Le gerant gagne la tendance et le classement ; le commercial ses chiffres. */
  readonly isAgencyScope = computed(() => this.figures()?.scope === 'all');

  /** Part du CA du meilleur, pour dimensionner les barres du classement. */
  readonly rankingMax = computed(() => {
    const rows = this.figures()?.ranking ?? [];
    return rows.length ? Math.max(...rows.map((r) => r.revenue)) : 0;
  });

  rankingPct(value: number): number {
    const max = this.rankingMax();
    return max === 0 ? 0 : Math.round((value / max) * 1000) / 10;
  }

  /** Le plus haut jour de la periode : c'est lui qui donne l'echelle. */
  private readonly trendMax = computed(() =>
    Math.max(0, ...(this.figures()?.trend ?? []).map((p) => p.revenue))
  );

  /**
   * Trente barres plutot qu'une courbe : une courbe lissee relie le dernier
   * jour vendu au suivant et efface les creux. Trente barres les montrent.
   */
  readonly trendBars = computed<TrendBar[]>(() => {
    const points = this.figures()?.trend ?? [];
    const max = this.trendMax();

    return points.map((p, i) => ({
      date: p.date,
      revenue: p.revenue,
      height: max === 0 ? 0 : Math.round((p.revenue / max) * 1000) / 10,
      isToday: i === points.length - 1,
    }));
  });

  readonly trendAverage = computed(() => {
    const points = this.figures()?.trend ?? [];
    if (!points.length) return 0;

    return Math.round((points.reduce((sum, p) => sum + p.revenue, 0) / points.length) * 100) / 100;
  });

  /** Hauteur du trait de moyenne, sur la meme echelle que les barres. */
  readonly trendAveragePct = computed(() => {
    const max = this.trendMax();
    return max === 0 ? 0 : Math.round((this.trendAverage() / max) * 1000) / 10;
  });

  /**
   * Avancement du mois vers l'objectif. `null` quand aucun objectif n'est
   * fixe — mieux vaut pas de barre qu'une barre a 0 %. Plafonne a 100 % :
   * depasser son objectif ne doit pas faire deborder la barre.
   */
  targetPct(): number | null {
    const month = this.figures()?.month;
    if (!month?.target) return null;

    return Math.min(100, Math.round((month.revenue / month.target) * 1000) / 10);
  }

  ngOnInit(): void {
    this.user.set(this.authService.user());
    this.pageHeader.set('Accueil');
    this.loadQueues();
  }

  ngOnDestroy(): void {
    this.pageHeader.clear();
  }

  /**
   * Le salut et le compte vont dans la barre superieure, sur une ligne — la
   * maquette n'a pas de gros titre : la page commence par la premiere file.
   */
  private publishHeader(): void {
    const name = this.user()?.name;
    const count = this.pendingTotal();
    const scope = this.isAgencyScope() ? ' sur toute l’agence' : ' à traiter';

    this.pageHeader.set(
      'Accueil',
      `Bonjour${name ? ' ' + name : ''} — `,
      count > 0 ? `${count} élément${count > 1 ? 's' : ''}${scope}` : 'rien en attente',
    );
  }

  loadQueues(): void {
    this.loading.set(true);
    this.loadError.set('');

    this.dashboardService.getWorkQueues().subscribe({
      next: (queues) => {
        this.queues.set(queues);
        this.loading.set(false);
        this.publishHeader();
      },
      error: (err) => {
        this.loading.set(false);
        this.loadError.set(formatErrorDetail('GET', err?.url ?? '/api/work-queues', err?.status ?? 0));
      },
    });
  }

  /** Un impayé se règle sur la vente : on ouvre la vente, pas une page intermédiaire. */
  openSale(id: number): void {
    this.router.navigate(['/sales'], { queryParams: { id } });
  }

  /** Le CA du jour mène au détail de la journée, pas à la liste entière. */
  openToday(): void {
    this.router.navigate(['/sales'], { queryParams: { date: todayIso() } });
  }

  openServiceOrder(id: number): void {
    this.router.navigate(['/service-orders'], { queryParams: { id } });
  }

  /**
   * Un achat en retard se regle sur l'achat : on ouvre directement son
   * panneau de paiement, pas seulement sa fiche — une file qui signale sans
   * faire gagner de temps ne sert a rien (voir `order()` ci-dessous).
   */
  payPurchase(row: PurchaseDueRow): void {
    this.router.navigate(['/achats'], { queryParams: { id: row.id, pay: 1 } });
  }

  /**
   * « Commander » ouvre un achat deja rempli — article, lot, quantite, dernier
   * prix, fournisseur habituel. Une file qui signale sans faire gagner de
   * temps ne sert a rien ; un formulaire vide en serait une.
   *
   * La quantite proposee remonte l'article a son seuil, et jamais moins d'une
   * unite : on ne commande pas zero pneu.
   */
  order(row: LowStockRow): void {
    this.router.navigate(['/achats'], {
      queryParams: {
        new: 1,
        product_id: row.product_id,
        // La reference sert au formulaire a retrouver l'article et a le
        // nommer : sans elle la ligne s'affiche « Produit #3 ».
        reference: row.reference,
        stock_id: row.stock_id,
        quantity: Math.max(1, row.threshold - row.stock),
        unit_price: row.unit_price,
        supplier_id: row.supplier_id,
      },
    });
  }

  /** Une ligne en retard se lit au premier coup d'œil. */
  isOverdue(date: string | null | undefined, days = 30): boolean {
    if (!date) return false;

    const when = new Date(date).getTime();
    if (Number.isNaN(when)) return false;

    return (Date.now() - when) / 86_400_000 > days;
  }
}
