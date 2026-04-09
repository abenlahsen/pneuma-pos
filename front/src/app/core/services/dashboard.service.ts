import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { DashboardKpi } from '../models/dashboard-kpi.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class DashboardService {
  constructor(private http: HttpClient) {}

  getKpi(): Observable<DashboardKpi> {
    return this.http.get<DashboardKpi>(`${environment.apiUrl}/dashboard-kpi`);
  }
}
