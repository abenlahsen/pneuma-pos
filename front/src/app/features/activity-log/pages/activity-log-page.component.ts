import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivityLogService } from '../data-access/activity-log.service';
import { ActivityLog, ActivityLogFilters, ActivityLogParams, ActivityLogSnapshot } from '../models/activity-log.model';

const FIELD_LABELS: Record<string, string> = {
  date: 'Date',
  status: 'Statut',
  payment_status: 'Statut paiement',
  total_sale: 'Total vente (MAD)',
  total_purchase: 'Total achat (MAD)',
  total_quantity: 'Quantité',
  margin: 'Marge (MAD)',
  net_amount: 'Montant net (MAD)',
  total_amount: 'Montant total (MAD)',
  payment_method: 'Mode de paiement',
  with_invoice: 'Avec facture',
  discount: 'Remise (%)',
  client: 'Client',
  commercial: 'Commercial',
  carrier: 'Transporteur',
  partner: 'Partenaire',
  supplier: 'Fournisseur',
  vehicle: 'Véhicule',
  mileage: 'Kilométrage',
  notes: 'Notes',
};

export interface FieldRow {
  key: string;
  label: string;
  before: unknown;
  after: unknown;
  changed: boolean;
}

@Component({
  selector: 'app-activity-log-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './activity-log-page.component.html',
  styleUrls: ['./activity-log-page.component.scss'],
})
export class ActivityLogPageComponent implements OnInit {
  logs = signal<ActivityLog[]>([]);
  filters = signal<ActivityLogFilters>({ entityTypes: [], actions: [], users: [] });

  loading = signal(false);

  currentPage = signal(1);
  lastPage = signal(1);
  total = signal(0);
  perPage = 50;

  filterEntityType = signal('');
  filterAction = signal('');
  filterUserId = signal('');
  filterDateFrom = signal('');
  filterDateTo = signal('');
  filterSearch = signal('');

  selectedLog = signal<ActivityLog | null>(null);

  constructor(private activityLogService: ActivityLogService) {}

  ngOnInit(): void {
    this.loadFilters();
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    const params: ActivityLogParams = {
      page: this.currentPage(),
      per_page: this.perPage,
    };
    if (this.filterEntityType()) params.entity_type = this.filterEntityType();
    if (this.filterAction()) params.action = this.filterAction();
    if (this.filterUserId()) params.user_id = this.filterUserId();
    if (this.filterDateFrom()) params.date_from = this.filterDateFrom();
    if (this.filterDateTo()) params.date_to = this.filterDateTo();
    if (this.filterSearch()) params.search = this.filterSearch();

    this.activityLogService.getLogs(params).subscribe({
      next: (res) => {
        this.logs.set(res.data);
        this.currentPage.set(res.current_page);
        this.lastPage.set(res.last_page);
        this.total.set(res.total);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  loadFilters(): void {
    this.activityLogService.getFilters().subscribe({
      next: (f) => this.filters.set(f),
    });
  }

  applyFilters(): void {
    this.currentPage.set(1);
    this.loadData();
  }

  resetFilters(): void {
    this.filterEntityType.set('');
    this.filterAction.set('');
    this.filterUserId.set('');
    this.filterDateFrom.set('');
    this.filterDateTo.set('');
    this.filterSearch.set('');
    this.currentPage.set(1);
    this.loadData();
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.lastPage()) return;
    this.currentPage.set(page);
    this.loadData();
  }

  openDetail(log: ActivityLog): void {
    this.selectedLog.set(log);
  }

  closeDetail(): void {
    this.selectedLog.set(null);
  }

  isPaymentAction(log: ActivityLog): boolean {
    return log.action === 'PAYMENT_ADD' || log.action === 'PAYMENT_DELETE';
  }

  getFieldRows(log: ActivityLog): FieldRow[] {
    const props = log.properties;
    if (!props) return [];

    if (this.isPaymentAction(log)) return [];

    const before = (props.before ?? {}) as ActivityLogSnapshot;
    const after = (props.after ?? {}) as ActivityLogSnapshot;

    const allKeys = new Set([
      ...Object.keys(before),
      ...Object.keys(after),
    ]);
    allKeys.delete('id');

    const rows: FieldRow[] = [];
    for (const key of allKeys) {
      const bVal = before[key] ?? null;
      const aVal = after[key] ?? null;
      rows.push({
        key,
        label: FIELD_LABELS[key] ?? key,
        before: bVal,
        after: aVal,
        changed: log.action === 'UPDATE' && String(bVal) !== String(aVal),
      });
    }

    return rows;
  }

  formatValue(val: unknown): string {
    if (val === null || val === undefined) return '—';
    if (typeof val === 'boolean') return val ? 'Oui' : 'Non';
    if (typeof val === 'number') return String(val);
    return String(val);
  }

  detailTitle(log: ActivityLog): string {
    if (log.action === 'CREATE') return 'Données à la création';
    if (log.action === 'DELETE') return 'Données au moment de la suppression';
    if (log.action === 'UPDATE') return 'Avant / Après modification';
    return 'Détail';
  }

  actionLabel(action: string): string {
    const map: Record<string, string> = {
      CREATE: 'Création',
      UPDATE: 'Modification',
      DELETE: 'Suppression',
      PAYMENT_ADD: 'Paiement ajouté',
      PAYMENT_DELETE: 'Paiement supprimé',
    };
    return map[action] ?? action;
  }

  entityTypeLabel(type: string): string {
    const map: Record<string, string> = {
      vente: 'Vente',
      achat: 'Achat',
      service_order: 'Service Auto',
    };
    return map[type] ?? type;
  }

  actionClass(action: string): string {
    const map: Record<string, string> = {
      CREATE: 'badge-success',
      UPDATE: 'badge-blue',
      DELETE: 'badge-danger',
      PAYMENT_ADD: 'badge-purple',
      PAYMENT_DELETE: 'badge-warning',
    };
    return map[action] ?? '';
  }

  entityClass(type: string): string {
    const map: Record<string, string> = {
      vente: 'entity-vente',
      achat: 'entity-achat',
      service_order: 'entity-service',
    };
    return map[type] ?? '';
  }

  pages(): number[] {
    const last = this.lastPage();
    const current = this.currentPage();
    const pages: number[] = [];
    const start = Math.max(1, current - 2);
    const end = Math.min(last, current + 2);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }
}
