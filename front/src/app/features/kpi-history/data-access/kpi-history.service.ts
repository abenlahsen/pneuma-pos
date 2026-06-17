import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { KpiHistoryResponse } from '../models/kpi-history.model';

@Injectable({ providedIn: 'root' })
export class KpiHistoryService {
  private readonly url = '/api/kpi-history';

  constructor(private http: HttpClient) {}

  getHistory(filters: {
    from?: string;
    to?: string;
    page?: number;
    per_page?: number;
  }): Observable<KpiHistoryResponse> {
    let params = new HttpParams();
    if (filters.from)     params = params.set('from', filters.from);
    if (filters.to)       params = params.set('to', filters.to);
    if (filters.page)     params = params.set('page', filters.page.toString());
    if (filters.per_page) params = params.set('per_page', filters.per_page.toString());
    return this.http.get<KpiHistoryResponse>(this.url, { params });
  }
}
