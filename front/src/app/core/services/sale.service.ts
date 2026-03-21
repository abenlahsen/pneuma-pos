import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Sale, SalePayload, SaleSummary, PaginatedResponse, SaleFilters } from '../models/sale.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SaleService {
  private apiUrl = `${environment.apiUrl}/sales`;

  constructor(private http: HttpClient) {}

  getSales(filters: Record<string, string> = {}): Observable<PaginatedResponse<Sale>> {
    const params = new HttpParams({ fromObject: filters });
    return this.http.get<PaginatedResponse<Sale>>(this.apiUrl, { params });
  }

  getSummary(filters: Record<string, string> = {}): Observable<SaleSummary> {
    const params = new HttpParams({ fromObject: filters });
    return this.http.get<SaleSummary>(`${environment.apiUrl}/sales-summary`, { params });
  }

  getFilters(): Observable<SaleFilters> {
    return this.http.get<SaleFilters>(`${environment.apiUrl}/sales-filters`);
  }

  createSale(payload: SalePayload): Observable<Sale> {
    return this.http.post<Sale>(this.apiUrl, payload);
  }

  updateSale(id: number, payload: SalePayload): Observable<Sale> {
    return this.http.put<Sale>(`${this.apiUrl}/${id}`, payload);
  }

  deleteSale(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
