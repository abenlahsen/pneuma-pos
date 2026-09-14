import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { DashboardKpi } from '../models/dashboard-kpi.model';
import { WorkQueues } from '../models/work-queue.model';
import { environment } from '../../../environments/environment';

export interface DashboardKpiFilters {
  day?: string;
  month?: string;
  year?: string;
}

@Injectable({
  providedIn: 'root',
})
export class DashboardService {
  constructor(private http: HttpClient) {}

  /**
   * Files de travail de l'accueil. Le serveur decide quelles files renvoyer
   * et jusqu'ou : rien n'est filtre ici.
   */
  getWorkQueues(): Observable<WorkQueues> {
    return this.http.get<WorkQueues>(`${environment.apiUrl}/work-queues`);
  }

  getKpi(filters?: DashboardKpiFilters): Observable<DashboardKpi> {
    let params = new HttpParams();

    if (filters?.day) {
      params = params.set('day', filters.day);
    }

    if (filters?.month) {
      params = params.set('month', filters.month);
    }

    if (filters?.year) {
      params = params.set('year', filters.year);
    }

    return this.http.get<DashboardKpi>(`${environment.apiUrl}/dashboard-kpi`, {
      params,
    });
  }
}