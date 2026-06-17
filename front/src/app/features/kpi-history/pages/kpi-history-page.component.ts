import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { KpiHistoryService } from '../data-access/kpi-history.service';
import { KpiSnapshot, DashboardKpi, CommercialKpi } from '../models/kpi-history.model';
import { AutoRefreshControlComponent } from '../../../shared/auto-refresh-control/auto-refresh-control.component';

@Component({
  selector: 'app-kpi-history-page',
  standalone: true,
  imports: [CommonModule, FormsModule, AutoRefreshControlComponent],
  templateUrl: './kpi-history-page.component.html',
  styleUrl: './kpi-history-page.component.scss',
})
export class KpiHistoryPageComponent implements OnInit {
  snapshots = signal<KpiSnapshot[]>([]);
  loading   = signal(false);
  totalPages = signal(0);
  totalItems = signal(0);

  filterFrom = signal('');
  filterTo   = signal('');
  page       = signal(1);
  perPage    = 30;

  selectedSnapshot = signal<KpiSnapshot | null>(null);
  detailTab = signal<'global' | 'commerciaux'>('global');

  constructor(private svc: KpiHistoryService) {}

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.svc.getHistory({
      from:     this.filterFrom() || undefined,
      to:       this.filterTo()   || undefined,
      page:     this.page(),
      per_page: this.perPage,
    }).subscribe({
      next: (res) => {
        this.snapshots.set(res.data);
        this.totalPages.set(res.meta.last_page);
        this.totalItems.set(res.meta.total);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  applyFilters() {
    this.page.set(1);
    this.load();
  }

  resetFilters() {
    this.filterFrom.set('');
    this.filterTo.set('');
    this.page.set(1);
    this.load();
  }

  goPage(p: number) {
    this.page.set(p);
    this.load();
  }

  openDetail(snap: KpiSnapshot) {
    this.selectedSnapshot.set(snap);
    this.detailTab.set('global');
  }

  closeDetail() { this.selectedSnapshot.set(null); }

  get pages(): number[] {
    return Array.from({ length: this.totalPages() }, (_, i) => i + 1);
  }

  fmt(v: number | undefined | null): string {
    if (v == null) return '—';
    return new Intl.NumberFormat('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
  }

  fmtInt(v: number | undefined | null): string {
    if (v == null) return '—';
    return new Intl.NumberFormat('fr-MA').format(v);
  }

  fmtDate(d: string): string {
    if (!d) return '—';
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
  }

  globalRows(data: DashboardKpi): { label: string; today: string; month: string; year: string }[] {
    return [
      { label: 'CA Ventes',          today: this.fmt(data.sales_today_amount),    month: this.fmt(data.sales_month_amount),    year: this.fmt(data.total_sale_year) },
      { label: 'CA Achats',          today: this.fmt(data.purchases_today_amount), month: this.fmt(data.purchases_month_amount), year: this.fmt(data.total_purchase_year) },
      { label: 'Marge brute',        today: this.fmt(data.margin_today),           month: this.fmt(data.margin_month),           year: this.fmt(data.margin_year) },
      { label: 'Marge nette',        today: this.fmt(data.net_margin_today),       month: this.fmt(data.net_margin_month),       year: this.fmt(data.net_margin_year) },
      { label: 'Dépenses',           today: this.fmt(data.expenses_today),         month: this.fmt(data.expenses_month),         year: this.fmt(data.expenses_year) },
      { label: 'Pneus vendus',       today: this.fmtInt(data.tyres_today),         month: this.fmtInt(data.tyres_month),         year: this.fmtInt(data.tyres_year) },
      { label: 'Pièces vendues',     today: '—',                                   month: this.fmtInt(data.parts_month),         year: this.fmtInt(data.parts_year) },
      { label: 'Pneus achetés',      today: this.fmtInt(data.tyres_purchased_today), month: this.fmtInt(data.tyres_purchased_month), year: this.fmtInt(data.tyres_purchased_year) },
      { label: 'Pièces achetées',    today: '—',                                   month: this.fmtInt(data.parts_purchased_month), year: this.fmtInt(data.parts_purchased_year) },
    ];
  }

  stockRows(data: DashboardKpi): { label: string; value: string }[] {
    return [
      { label: 'Quantité en stock',  value: this.fmtInt(data.stock_quantity) },
      { label: 'Valeur du stock',    value: this.fmt(data.stock_value) + ' DH' },
      { label: 'Impayés ventes',     value: this.fmt(data.unpaid_sales) + ' DH' },
      { label: 'Impayés achats',     value: this.fmt(data.unpaid_purchases) + ' DH' },
      { label: 'Trésorerie',         value: this.fmt(data.cash_balance) + ' DH' },
    ];
  }
}
