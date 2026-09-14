import { Component, Inject, LOCALE_ID, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { PageHeaderService } from '../../../core/services/page-header.service';
import { CommonModule, formatNumber } from '@angular/common';
import { ReportingService } from '../data-access/reporting.service';
import { MonthlyReport, ReportPeriodData } from '../models/reporting.model';
import { IconComponent } from '../../../shared/icon/icon.component';
import { buildComparisonBars } from './comparison-bars';

const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

export type KpiKind = 'money' | 'int' | 'percent';

/**
 * `tone` says how to colour the M-1 delta: 'up-good' (revenue, margin…),
 * 'up-bad' (charges, impayés…) or 'neutral' (purchases, supplier payments —
 * buying more is neither good nor bad on its own).
 */
export type KpiTone = 'up-good' | 'up-bad' | 'neutral';

export interface KpiCard {
  icon: string;
  label: string;
  value: number;
  prev: number;
  kind: KpiKind;
  tone: KpiTone;
  sub?: string;
  variant?: 'red' | 'blue' | 'warning';
}

export interface ReportSection {
  key: string;
  title: string;
  cards: KpiCard[];
}

export interface CompareRow {
  label: string;
  value: number;
  prev: number;
  share?: number;
}

export interface MethodRow {
  method: string;
  collections: number;
  supplierPayments: number;
}

@Component({
  selector: 'app-reporting-page',
  standalone: true,
  imports: [IconComponent, CommonModule],
  templateUrl: './reporting-page.component.html',
  styleUrls: ['./reporting-page.component.scss'],
})
export class ReportingPageComponent implements OnInit, OnDestroy {
  private readonly pageHeader = inject(PageHeaderService);
  report = signal<MonthlyReport | null>(null);
  loading = signal(false);
  error = signal<string | null>(null);

  selectedYear = signal(new Date().getFullYear());
  selectedMonth = signal(new Date().getMonth() + 1);

  /**
   * Mois / Trimestre / Annee (`3h`). C'est l'ecran qui porte le detail par
   * periode que l'accueil ne porte plus : sans les trois vues, l'information
   * a disparu de l'application.
   */
  readonly granularity = signal<'month' | 'quarter' | 'year'>('month');

  readonly selectedQuarter = computed(() => Math.ceil(this.selectedMonth() / 3));

  readonly now = new Date();
  readonly currentYear = this.now.getFullYear();
  readonly currentMonth = this.now.getMonth() + 1;

  /** Le libelle vient du serveur : lui seul connait les bornes reelles. */
  monthLabel = computed(() => this.report()?.period?.label
    ?? `${MONTH_NAMES[this.selectedMonth() - 1]} ${this.selectedYear()}`);

  previousLabel = computed(() => this.report()?.previous_period?.label ?? 'la période précédente');

  /** Les cinq cadrans de `3h`, dans un seul cadre comme le motif liste. */
  readonly kpis = computed(() => {
    const c = this.cur()?.kpi;
    const p = this.prev()?.kpi;
    if (!c) return [];

    return [
      { label: 'CA de période', value: c.revenue, prev: p?.revenue ?? 0, unit: 'DH' },
      { label: 'Marge brute', value: c.gross_margin, prev: p?.gross_margin ?? 0, unit: 'DH' },
      { label: 'Panier moyen', value: c.basket, prev: p?.basket ?? 0, unit: 'DH' },
      { label: 'Rotation de stock', value: c.stock_turns, prev: p?.stock_turns ?? 0, unit: 'x' },
      { label: 'Impayés', value: c.unpaid, prev: p?.unpaid ?? 0, unit: 'DH', alert: true },
    ];
  });

  /** Le graphique unique : CA du mois, annee precedente derriere en gris. */
  readonly seriesBars = computed(() => {
    const rows = this.report()?.series ?? [];
    const max = Math.max(0, ...rows.flatMap((r) => [r.revenue, r.previous_revenue]));

    return rows.map((r) => ({
      label: r.label.slice(0, 3),
      revenue: r.revenue,
      previous: r.previous_revenue,
      pct: max === 0 ? 0 : Math.round((r.revenue / max) * 1000) / 10,
      previousPct: max === 0 ? 0 : Math.round((r.previous_revenue / max) * 1000) / 10,
      // Le rouge ne sert qu'a pointer une valeur : ici le mois record.
      isPeak: max > 0 && r.revenue === max,
    }));
  });

  isCurrentMonth = computed(
    () => this.selectedYear() === this.currentYear && this.selectedMonth() === this.currentMonth,
  );

  cur = computed<ReportPeriodData | null>(() => this.report()?.current ?? null);
  prev = computed<ReportPeriodData | null>(() => this.report()?.previous ?? null);

  sections = computed<ReportSection[]>(() => {
    const c = this.cur();
    const p = this.prev();
    if (!c || !p) return [];

    const fmtInt = (v: number) => this.formatInt(v);
    const fmtMoney = (v: number) => `${this.formatMoney(v)} DH`;

    return [
      {
        key: 'sales',
        title: 'Ventes',
        cards: [
          { icon: 'cash', label: 'CA Ventes', value: c.sales.total, prev: p.sales.total, kind: 'money', tone: 'up-good', variant: 'red',
            sub: `${fmtInt(c.sales.count)} vente(s) · panier moyen ${fmtMoney(c.sales.avg_basket)}` },
          { icon: 'payroll', label: 'Avec facture', value: c.sales.with_invoice, prev: p.sales.with_invoice, kind: 'money', tone: 'up-good' },
          { icon: 'edit', label: 'Sans facture', value: c.sales.without_invoice, prev: p.sales.without_invoice, kind: 'money', tone: 'up-good' },
          { icon: 'stock', label: 'Pneus vendus', value: c.sales.tyres_qty, prev: p.sales.tyres_qty, kind: 'int', tone: 'up-good',
            sub: `${fmtInt(c.sales.parts_qty)} pièce(s) vendue(s)` },
          { icon: 'reporting', label: 'Prix moyen / pneu', value: c.sales.avg_price_per_tyre, prev: p.sales.avg_price_per_tyre, kind: 'money', tone: 'up-good' },
          { icon: '⏳', label: 'Impayés générés', value: c.sales.unpaid_generated, prev: p.sales.unpaid_generated, kind: 'money', tone: 'up-bad', variant: 'warning',
            sub: 'Reste dû sur les ventes du mois' },
        ],
      },
      {
        key: 'purchases',
        title: 'Achats',
        cards: [
          { icon: 'purchases', label: 'Achats nets', value: c.purchases.total, prev: p.purchases.total, kind: 'money', tone: 'neutral', variant: 'blue',
            sub: `${fmtInt(c.purchases.count)} achat(s) · après remises et retours` },
          { icon: 'payroll', label: 'Avec facture', value: c.purchases.with_invoice, prev: p.purchases.with_invoice, kind: 'money', tone: 'neutral' },
          { icon: 'edit', label: 'Sans facture', value: c.purchases.without_invoice, prev: p.purchases.without_invoice, kind: 'money', tone: 'neutral' },
          { icon: 'stock', label: 'Pneus achetés', value: c.purchases.tyres_qty, prev: p.purchases.tyres_qty, kind: 'int', tone: 'neutral',
            sub: `${fmtInt(c.purchases.parts_qty)} pièce(s) achetée(s)` },
          { icon: '↩️', label: 'Retours fournisseurs', value: c.purchases.returns_amount, prev: p.purchases.returns_amount, kind: 'money', tone: 'neutral',
            sub: `${fmtInt(c.purchases.returns_count)} retour(s) · ${fmtMoney(c.purchases.refunds_received)} remboursés` },
          { icon: '⏳', label: 'Impayés générés', value: c.purchases.unpaid_generated, prev: p.purchases.unpaid_generated, kind: 'money', tone: 'up-bad', variant: 'warning',
            sub: 'Reste dû sur les achats du mois' },
        ],
      },
      {
        key: 'margin',
        title: 'Marge',
        cards: [
          { icon: 'kpi', label: 'Marge brute', value: c.margin.gross, prev: p.margin.gross, kind: 'money', tone: 'up-good', variant: 'red',
            sub: `Taux de marge ${this.formatPercent(c.margin.rate)} %` },
          { icon: 'sales', label: 'Marge ventes', value: c.margin.sales, prev: p.margin.sales, kind: 'money', tone: 'up-good' },
          { icon: 'service', label: 'Marge Service Auto', value: c.margin.service, prev: p.margin.service, kind: 'money', tone: 'up-good' },
          { icon: 'cash', label: 'Autres revenus', value: c.margin.other_revenue, prev: p.margin.other_revenue, kind: 'money', tone: 'up-good' },
          { icon: 'cash', label: 'Charges', value: c.margin.expenses, prev: p.margin.expenses, kind: 'money', tone: 'up-bad', variant: 'warning' },
          { icon: 'kpi', label: 'Marge nette', value: c.margin.net, prev: p.margin.net, kind: 'money', tone: 'up-good', variant: 'red',
            sub: 'Marge brute − charges' },
        ],
      },
      {
        key: 'payments',
        title: 'Encaissements & paiements',
        cards: [
          { icon: 'invoice', label: 'Encaissements ventes', value: c.collections.total, prev: p.collections.total, kind: 'money', tone: 'up-good', variant: 'red',
            sub: c.collections.unallocated > 0 ? `dont ${fmtMoney(c.collections.unallocated)} non affectés` : undefined },
          { icon: 'payroll', label: 'Encaissé avec facture', value: c.collections.with_invoice, prev: p.collections.with_invoice, kind: 'money', tone: 'up-good' },
          { icon: 'edit', label: 'Encaissé sans facture', value: c.collections.without_invoice, prev: p.collections.without_invoice, kind: 'money', tone: 'up-good' },
          { icon: 'service', label: 'Encaissements Service Auto', value: c.collections.service_orders, prev: p.collections.service_orders, kind: 'money', tone: 'up-good' },
          { icon: 'supplier', label: 'Paiements fournisseurs', value: c.supplier_payments.total, prev: p.supplier_payments.total, kind: 'money', tone: 'neutral', variant: 'blue',
            sub: c.supplier_payments.unallocated > 0 ? `dont ${fmtMoney(c.supplier_payments.unallocated)} non affectés` : undefined },
          { icon: 'payroll', label: 'Payé avec facture', value: c.supplier_payments.with_invoice, prev: p.supplier_payments.with_invoice, kind: 'money', tone: 'neutral' },
          { icon: 'edit', label: 'Payé sans facture', value: c.supplier_payments.without_invoice, prev: p.supplier_payments.without_invoice, kind: 'money', tone: 'neutral' },
        ],
      },
      {
        key: 'payroll',
        title: 'Masse salariale',
        cards: [
          { icon: 'payroll', label: 'Masse salariale', value: c.payroll.total, prev: p.payroll.total, kind: 'money', tone: 'up-bad', variant: 'warning',
            sub: c.expenses.total > 0 ? `${this.formatPercent(c.payroll.total / c.expenses.total * 100)} % des charges` : undefined },
          { icon: 'users', label: 'Employés payés', value: c.payroll.employee_count, prev: p.payroll.employee_count, kind: 'int', tone: 'neutral' },
        ],
      },
      {
        key: 'service',
        title: 'Service Auto',
        cards: [
          { icon: 'service', label: 'CA Service Auto', value: c.service_orders.revenue, prev: p.service_orders.revenue, kind: 'money', tone: 'up-good', variant: 'red',
            sub: `${fmtInt(c.service_orders.count)} ordre(s) de service` },
          { icon: 'kpi', label: 'Marge Service Auto', value: c.service_orders.gross_margin, prev: p.service_orders.gross_margin, kind: 'money', tone: 'up-good' },
          { icon: 'invoice', label: 'Encaissements', value: c.service_orders.collected, prev: p.service_orders.collected, kind: 'money', tone: 'up-good' },
          { icon: 'stock', label: 'Pneus posés', value: c.service_orders.tyres_qty, prev: p.service_orders.tyres_qty, kind: 'int', tone: 'up-good' },
        ],
      },
      {
        key: 'cash',
        title: 'Trésorerie',
        cards: [
          { icon: '⬆️', label: 'Entrées réalisées', value: c.cash_flow.income_settled, prev: p.cash_flow.income_settled, kind: 'money', tone: 'up-good' },
          { icon: '⬇️', label: 'Sorties réalisées', value: c.cash_flow.expense_settled, prev: p.cash_flow.expense_settled, kind: 'money', tone: 'up-bad' },
          { icon: 'finance', label: 'Flux net', value: c.cash_flow.net, prev: p.cash_flow.net, kind: 'money', tone: 'up-good', variant: 'red',
            sub: 'Hors transferts entre comptes' },
          { icon: '⏳', label: 'Échéances à recevoir', value: c.cash_flow.pending_income, prev: p.cash_flow.pending_income, kind: 'money', tone: 'neutral',
            sub: 'Chèques / effets non échus' },
          { icon: '⏳', label: 'Échéances à payer', value: c.cash_flow.pending_expense, prev: p.cash_flow.pending_expense, kind: 'money', tone: 'neutral',
            sub: 'Chèques / effets non échus' },
          { icon: 'users', label: 'Nouveaux clients', value: c.clients.new_count, prev: p.clients.new_count, kind: 'int', tone: 'up-good' },
        ],
      },
    ];
  });

  expenseRows = computed<CompareRow[]>(() => {
    const c = this.cur();
    const p = this.prev();
    if (!c || !p) return [];
    const prevByCategory = new Map(p.expenses.by_category.map(r => [r.category, r.amount]));
    return c.expenses.by_category.map(r => ({
      label: r.category,
      value: r.amount,
      prev: prevByCategory.get(r.category) ?? 0,
      share: r.share,
    }));
  });

  payrollRows = computed<CompareRow[]>(() => {
    const c = this.cur();
    const p = this.prev();
    if (!c || !p) return [];
    return Object.entries(c.payroll.by_subcategory).map(([label, value]) => ({
      label,
      value,
      prev: p.payroll.by_subcategory[label] ?? 0,
      share: c.payroll.total > 0 ? Math.round(value / c.payroll.total * 1000) / 10 : 0,
    }));
  });

  methodRows = computed<MethodRow[]>(() => {
    const c = this.cur();
    if (!c) return [];
    const methods = new Set([
      ...Object.keys(c.collections.by_method),
      ...Object.keys(c.supplier_payments.by_method),
    ]);
    return [...methods]
      .map(method => ({
        method,
        collections: c.collections.by_method[method] ?? 0,
        supplierPayments: c.supplier_payments.by_method[method] ?? 0,
      }))
      .sort((a, b) => (b.collections + b.supplierPayments) - (a.collections + a.supplierPayments));
  });

  constructor(
    private reportingService: ReportingService,
    // Same locale as the `number` pipe used in the tables, so cards and
    // tables format figures identically.
    @Inject(LOCALE_ID) private locale: string = 'en-US',
  ) {}

  /** Titre, actions et rechargement vont dans la barre de la coquille (P1). */
  private publishHeader(): void {
    this.pageHeader.set('Reporting');
    this.pageHeader.setActions([
      { label: 'Exporter PDF', run: () => this.exportPdf(), variant: 'secondary' },
    ]);
  }

  ngOnDestroy(): void {
    this.pageHeader.clear();
  }

  ngOnInit(): void {
    this.publishHeader();
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    this.error.set(null);
    const unit = this.granularity() === 'quarter' ? this.selectedQuarter() : this.selectedMonth();

    this.reportingService.getMonthly(this.selectedYear(), unit, this.granularity()).subscribe({
      next: (res) => {
        this.report.set(res);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Impossible de charger le rapport. Veuillez réessayer.');
        this.loading.set(false);
      },
    });
  }

  setGranularity(g: 'month' | 'quarter' | 'year'): void {
    this.granularity.set(g);
    this.loadData();
  }

  /** Les fleches naviguent dans la periode choisie, pas toujours en mois. */
  prevMonth(): void {
    if (this.granularity() === 'year') {
      this.selectedYear.update((y) => y - 1);
      this.loadData();
      return;
    }

    if (this.granularity() === 'quarter') {
      const m = this.selectedMonth() - 3;
      if (m < 1) { this.selectedMonth.set(m + 12); this.selectedYear.update((y) => y - 1); }
      else this.selectedMonth.set(m);
      this.loadData();
      return;
    }

    if (this.selectedMonth() === 1) {
      this.selectedMonth.set(12);
      this.selectedYear.update(y => y - 1);
    } else {
      this.selectedMonth.update(m => m - 1);
    }
    this.loadData();
  }

  nextMonth(): void {
    if (this.granularity() === 'year') {
      if (this.selectedYear() >= this.currentYear) return;
      this.selectedYear.update((y) => y + 1);
      this.loadData();
      return;
    }

    if (this.granularity() === 'quarter') {
      if (this.isCurrentMonth()) return;
      const m = this.selectedMonth() + 3;
      if (m > 12) { this.selectedMonth.set(m - 12); this.selectedYear.update((y) => y + 1); }
      else this.selectedMonth.set(m);
      this.loadData();
      return;
    }

    if (this.isCurrentMonth()) return;
    if (this.selectedMonth() === 12) {
      this.selectedMonth.set(1);
      this.selectedYear.update(y => y + 1);
    } else {
      this.selectedMonth.update(m => m + 1);
    }
    this.loadData();
  }

  // ── Delta helpers ────────────────────────────────────────────────────────

  /** Percentage change vs. previous month; null when there is no baseline. */
  delta(value: number, prev: number): number | null {
    if (!prev) return null;
    return Math.round((value - prev) / Math.abs(prev) * 1000) / 10;
  }

  deltaLabel(value: number, prev: number): string {
    const d = this.delta(value, prev);
    if (d === null) return '—';
    if (d === 0) return '0 %';
    return `${d > 0 ? '+' : '−'}${this.formatPercent(Math.abs(d))} %`;
  }

  /** CSS modifier for the delta badge: 'good' | 'bad' | 'neutral' | 'none'. */
  deltaClass(value: number, prev: number, tone: KpiTone = 'up-good'): string {
    const d = this.delta(value, prev);
    if (d === null || d === 0 || tone === 'neutral') return d === null ? 'none' : 'neutral';
    const up = d > 0;
    return (tone === 'up-good') === up ? 'good' : 'bad';
  }

  // ── Formatting ───────────────────────────────────────────────────────────

  formatMoney(value: number): string {
    return formatNumber(value ?? 0, this.locale, '1.2-2');
  }

  formatInt(value: number): string {
    return formatNumber(value ?? 0, this.locale, '1.0-0');
  }

  formatPercent(value: number): string {
    return formatNumber(value ?? 0, this.locale, '1.1-1');
  }

  formatValue(card: KpiCard): string {
    switch (card.kind) {
      case 'money': return this.formatMoney(card.value);
      case 'percent': return this.formatPercent(card.value);
      default: return this.formatInt(card.value);
    }
  }

  trackSection(_: number, s: ReportSection): string { return s.key; }
  trackCard(_: number, c: KpiCard): string { return c.label; }
  trackRow(_: number, r: CompareRow): string { return r.label; }

  /**
   * Barres comparatives d'une section (`3h`) : mois courant en encre, mois
   * precedent en gris. Les pourcentages sont relatifs au maximum du groupe,
   * pour que les barres d'une meme section se comparent entre elles.
   * Les taux (marge en %) sont exclus : les melanger a des dirhams sur une
   * echelle commune ecraserait les uns ou les autres.
   */
  barsFor(section: ReportSection) {
    return buildComparisonBars(section.cards.filter((c) => c.kind !== 'percent'));
  }

  /**
   * « Exporter PDF » (`3h`) : on imprime la mise en page de l'ecran, on n'en
   * prend pas une capture. Les graphiques sont en SVG et les tableaux en HTML,
   * donc le navigateur les rend nativement, en vectoriel et selectionnables.
   */
  exportPdf(): void {
    window.print();
  }
}
