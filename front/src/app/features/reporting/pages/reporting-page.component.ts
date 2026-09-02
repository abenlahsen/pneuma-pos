import { Component, Inject, LOCALE_ID, OnInit, computed, signal } from '@angular/core';
import { CommonModule, formatNumber } from '@angular/common';
import { ReportingService } from '../data-access/reporting.service';
import { MonthlyReport, ReportPeriodData } from '../models/reporting.model';

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
  imports: [CommonModule],
  templateUrl: './reporting-page.component.html',
  styleUrls: ['./reporting-page.component.scss'],
})
export class ReportingPageComponent implements OnInit {
  report = signal<MonthlyReport | null>(null);
  loading = signal(false);
  error = signal<string | null>(null);

  selectedYear = signal(new Date().getFullYear());
  selectedMonth = signal(new Date().getMonth() + 1);

  readonly now = new Date();
  readonly currentYear = this.now.getFullYear();
  readonly currentMonth = this.now.getMonth() + 1;

  monthLabel = computed(() => `${MONTH_NAMES[this.selectedMonth() - 1]} ${this.selectedYear()}`);

  previousLabel = computed(() => {
    const p = this.report()?.previous_period;
    return p ? `${MONTH_NAMES[p.month - 1]} ${p.year}` : 'M-1';
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
        title: '🏷️ Ventes',
        cards: [
          { icon: '💰', label: 'CA Ventes', value: c.sales.total, prev: p.sales.total, kind: 'money', tone: 'up-good', variant: 'red',
            sub: `${fmtInt(c.sales.count)} vente(s) · panier moyen ${fmtMoney(c.sales.avg_basket)}` },
          { icon: '🧾', label: 'Avec facture', value: c.sales.with_invoice, prev: p.sales.with_invoice, kind: 'money', tone: 'up-good' },
          { icon: '📝', label: 'Sans facture', value: c.sales.without_invoice, prev: p.sales.without_invoice, kind: 'money', tone: 'up-good' },
          { icon: '🛞', label: 'Pneus vendus', value: c.sales.tyres_qty, prev: p.sales.tyres_qty, kind: 'int', tone: 'up-good',
            sub: `${fmtInt(c.sales.parts_qty)} pièce(s) vendue(s)` },
          { icon: '📊', label: 'Prix moyen / pneu', value: c.sales.avg_price_per_tyre, prev: p.sales.avg_price_per_tyre, kind: 'money', tone: 'up-good' },
          { icon: '⏳', label: 'Impayés générés', value: c.sales.unpaid_generated, prev: p.sales.unpaid_generated, kind: 'money', tone: 'up-bad', variant: 'warning',
            sub: 'Reste dû sur les ventes du mois' },
        ],
      },
      {
        key: 'purchases',
        title: '📦 Achats',
        cards: [
          { icon: '📦', label: 'Achats nets', value: c.purchases.total, prev: p.purchases.total, kind: 'money', tone: 'neutral', variant: 'blue',
            sub: `${fmtInt(c.purchases.count)} achat(s) · après remises et retours` },
          { icon: '🧾', label: 'Avec facture', value: c.purchases.with_invoice, prev: p.purchases.with_invoice, kind: 'money', tone: 'neutral' },
          { icon: '📝', label: 'Sans facture', value: c.purchases.without_invoice, prev: p.purchases.without_invoice, kind: 'money', tone: 'neutral' },
          { icon: '🛞', label: 'Pneus achetés', value: c.purchases.tyres_qty, prev: p.purchases.tyres_qty, kind: 'int', tone: 'neutral',
            sub: `${fmtInt(c.purchases.parts_qty)} pièce(s) achetée(s)` },
          { icon: '↩️', label: 'Retours fournisseurs', value: c.purchases.returns_amount, prev: p.purchases.returns_amount, kind: 'money', tone: 'neutral',
            sub: `${fmtInt(c.purchases.returns_count)} retour(s) · ${fmtMoney(c.purchases.refunds_received)} remboursés` },
          { icon: '⏳', label: 'Impayés générés', value: c.purchases.unpaid_generated, prev: p.purchases.unpaid_generated, kind: 'money', tone: 'up-bad', variant: 'warning',
            sub: 'Reste dû sur les achats du mois' },
        ],
      },
      {
        key: 'margin',
        title: '📈 Marge',
        cards: [
          { icon: '📈', label: 'Marge brute', value: c.margin.gross, prev: p.margin.gross, kind: 'money', tone: 'up-good', variant: 'red',
            sub: `Taux de marge ${this.formatPercent(c.margin.rate)} %` },
          { icon: '🏷️', label: 'Marge ventes', value: c.margin.sales, prev: p.margin.sales, kind: 'money', tone: 'up-good' },
          { icon: '🔧', label: 'Marge Service Auto', value: c.margin.service, prev: p.margin.service, kind: 'money', tone: 'up-good' },
          { icon: '💵', label: 'Autres revenus', value: c.margin.other_revenue, prev: p.margin.other_revenue, kind: 'money', tone: 'up-good' },
          { icon: '💸', label: 'Charges', value: c.margin.expenses, prev: p.margin.expenses, kind: 'money', tone: 'up-bad', variant: 'warning' },
          { icon: '🏁', label: 'Marge nette', value: c.margin.net, prev: p.margin.net, kind: 'money', tone: 'up-good', variant: 'red',
            sub: 'Marge brute − charges' },
        ],
      },
      {
        key: 'payments',
        title: '💳 Encaissements & paiements',
        cards: [
          { icon: '💳', label: 'Encaissements ventes', value: c.collections.total, prev: p.collections.total, kind: 'money', tone: 'up-good', variant: 'red',
            sub: c.collections.unallocated > 0 ? `dont ${fmtMoney(c.collections.unallocated)} non affectés` : undefined },
          { icon: '🧾', label: 'Encaissé avec facture', value: c.collections.with_invoice, prev: p.collections.with_invoice, kind: 'money', tone: 'up-good' },
          { icon: '📝', label: 'Encaissé sans facture', value: c.collections.without_invoice, prev: p.collections.without_invoice, kind: 'money', tone: 'up-good' },
          { icon: '🔧', label: 'Encaissements Service Auto', value: c.collections.service_orders, prev: p.collections.service_orders, kind: 'money', tone: 'up-good' },
          { icon: '🏢', label: 'Paiements fournisseurs', value: c.supplier_payments.total, prev: p.supplier_payments.total, kind: 'money', tone: 'neutral', variant: 'blue',
            sub: c.supplier_payments.unallocated > 0 ? `dont ${fmtMoney(c.supplier_payments.unallocated)} non affectés` : undefined },
          { icon: '🧾', label: 'Payé avec facture', value: c.supplier_payments.with_invoice, prev: p.supplier_payments.with_invoice, kind: 'money', tone: 'neutral' },
          { icon: '📝', label: 'Payé sans facture', value: c.supplier_payments.without_invoice, prev: p.supplier_payments.without_invoice, kind: 'money', tone: 'neutral' },
        ],
      },
      {
        key: 'payroll',
        title: '🧑‍💼 Masse salariale',
        cards: [
          { icon: '🧑‍💼', label: 'Masse salariale', value: c.payroll.total, prev: p.payroll.total, kind: 'money', tone: 'up-bad', variant: 'warning',
            sub: c.expenses.total > 0 ? `${this.formatPercent(c.payroll.total / c.expenses.total * 100)} % des charges` : undefined },
          { icon: '👥', label: 'Employés payés', value: c.payroll.employee_count, prev: p.payroll.employee_count, kind: 'int', tone: 'neutral' },
        ],
      },
      {
        key: 'service',
        title: '🔧 Service Auto',
        cards: [
          { icon: '🔧', label: 'CA Service Auto', value: c.service_orders.revenue, prev: p.service_orders.revenue, kind: 'money', tone: 'up-good', variant: 'red',
            sub: `${fmtInt(c.service_orders.count)} ordre(s) de service` },
          { icon: '📈', label: 'Marge Service Auto', value: c.service_orders.gross_margin, prev: p.service_orders.gross_margin, kind: 'money', tone: 'up-good' },
          { icon: '💳', label: 'Encaissements', value: c.service_orders.collected, prev: p.service_orders.collected, kind: 'money', tone: 'up-good' },
          { icon: '🛞', label: 'Pneus posés', value: c.service_orders.tyres_qty, prev: p.service_orders.tyres_qty, kind: 'int', tone: 'up-good' },
        ],
      },
      {
        key: 'cash',
        title: '🏦 Trésorerie',
        cards: [
          { icon: '⬆️', label: 'Entrées réalisées', value: c.cash_flow.income_settled, prev: p.cash_flow.income_settled, kind: 'money', tone: 'up-good' },
          { icon: '⬇️', label: 'Sorties réalisées', value: c.cash_flow.expense_settled, prev: p.cash_flow.expense_settled, kind: 'money', tone: 'up-bad' },
          { icon: '🏦', label: 'Flux net', value: c.cash_flow.net, prev: p.cash_flow.net, kind: 'money', tone: 'up-good', variant: 'red',
            sub: 'Hors transferts entre comptes' },
          { icon: '⏳', label: 'Échéances à recevoir', value: c.cash_flow.pending_income, prev: p.cash_flow.pending_income, kind: 'money', tone: 'neutral',
            sub: 'Chèques / effets non échus' },
          { icon: '⏳', label: 'Échéances à payer', value: c.cash_flow.pending_expense, prev: p.cash_flow.pending_expense, kind: 'money', tone: 'neutral',
            sub: 'Chèques / effets non échus' },
          { icon: '👥', label: 'Nouveaux clients', value: c.clients.new_count, prev: p.clients.new_count, kind: 'int', tone: 'up-good' },
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

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    this.error.set(null);
    this.reportingService.getMonthly(this.selectedYear(), this.selectedMonth()).subscribe({
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
}
