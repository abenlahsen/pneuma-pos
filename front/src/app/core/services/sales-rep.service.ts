import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { SalesRep, SalesRepPayload, PaginatedResponse } from '../models/sales-rep.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SalesRepService {
  private apiUrl = `${environment.apiUrl}/sales-reps`;

  constructor(private http: HttpClient) {}

  getSalesReps(filters: Record<string, string | boolean> = {}): Observable<PaginatedResponse<SalesRep> | SalesRep[]> {
    const params = new HttpParams({ fromObject: filters as any });
    return this.http.get<PaginatedResponse<SalesRep> | SalesRep[]>(this.apiUrl, { params });
  }

  createSalesRep(payload: SalesRepPayload): Observable<SalesRep> {
    return this.http.post<SalesRep>(this.apiUrl, payload);
  }

  updateSalesRep(id: number, payload: SalesRepPayload): Observable<SalesRep> {
    return this.http.put<SalesRep>(`${this.apiUrl}/${id}`, payload);
  }

  deleteSalesRep(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
