import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivityLogService } from '../data-access/activity-log.service';
import { ActivityLog, ActivityLogFilters, ActivityLogParams } from '../models/activity-log.model';

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
