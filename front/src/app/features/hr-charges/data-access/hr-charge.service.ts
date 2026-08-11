import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  HrCharge,
  HrChargeBatchPayload,
  HrChargeFilters,
  HrChargeListResponse,
  HrChargeSummary,
  HrChargeUpdatePayload,
} from '../models/hr-charge.model';

@Injectable({ providedIn: 'root' })
export class HrChargeService {
  private apiUrl = `${environment.apiUrl}/hr-charges`;

  constructor(private http: HttpClient) {}

  private monthParams(year: number, month: number, employeeId: number | null, subcategory: string | null): HttpParams {
    let params = new HttpParams().set('year', year.toString()).set('month', month.toString());
    if (employeeId) params = params.set('employee_id', employeeId.toString());
    if (subcategory) params = params.set('subcategory', subcategory);
    return params;
  }

  list(year: number, month: number, employeeId: number | null = null, subcategory: string | null = null): Observable<HrChargeListResponse> {
    return this.http.get<HrChargeListResponse>(this.apiUrl, {
      params: this.monthParams(year, month, employeeId, subcategory),
    });
  }

  summary(year: number, month: number, employeeId: number | null = null, subcategory: string | null = null): Observable<HrChargeSummary> {
    return this.http.get<HrChargeSummary>(`${this.apiUrl}-summary`, {
      params: this.monthParams(year, month, employeeId, subcategory),
    });
  }

  filters(): Observable<HrChargeFilters> {
    return this.http.get<HrChargeFilters>(`${this.apiUrl}-filters`);
  }

  createBatch(payload: HrChargeBatchPayload): Observable<HrCharge[]> {
    return this.http.post<HrCharge[]>(this.apiUrl, payload);
  }

  update(id: number, payload: HrChargeUpdatePayload): Observable<HrCharge> {
    return this.http.put<HrCharge>(`${this.apiUrl}/${id}`, payload);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  updateEmployee(userId: number, payload: { salary?: number | null; cnss_number?: string | null; hire_date?: string | null }): Observable<any> {
    return this.http.put(`${environment.apiUrl}/hr-employees/${userId}`, payload);
  }
}
