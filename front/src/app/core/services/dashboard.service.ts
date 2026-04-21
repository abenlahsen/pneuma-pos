import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { DashboardKpi } from '../models/dashboard-kpi.model';
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