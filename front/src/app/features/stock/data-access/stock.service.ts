import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Stock, StockPayload, StockSummary, StockFilters, StockMovement } from '../models/stock.model';
import { PaginatedResponse } from '../../sales/models/sale.model';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class StockService {
  private apiUrl = `${environment.apiUrl}/stocks`;

  constructor(private http: HttpClient) {}

  getStocks(filters: Record<string, string> = {}): Observable<PaginatedResponse<Stock>> {
    const params = new HttpParams({ fromObject: filters });
    return this.http.get<PaginatedResponse<Stock>>(this.apiUrl, { params });
  }

  getSummary(filters: Record<string, string> = {}): Observable<StockSummary> {
    const params = new HttpParams({ fromObject: filters });
    return this.http.get<StockSummary>(`${environment.apiUrl}/stocks-summary`, { params });
  }

  getFilters(): Observable<StockFilters> {
    return this.http.get<StockFilters>(`${environment.apiUrl}/stocks-filters`);
  }

  createStock(payload: StockPayload): Observable<Stock> {
    return this.http.post<Stock>(this.apiUrl, payload);
  }

  updateStock(id: number, payload: StockPayload): Observable<Stock> {
    return this.http.put<Stock>(`${this.apiUrl}/${id}`, payload);
  }

  deleteStock(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  importStock(file: File): Observable<{ message: string; count: number }> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post<{ message: string; count: number }>(`${this.apiUrl}/import`, formData);
  }

  exportAvailableStock(filters: Record<string, string> = {}): Observable<Blob> {
    const params = new HttpParams({ fromObject: filters });
    return this.http.get(`${this.apiUrl}/export`, {
      params,
      responseType: 'blob',
    });
  }

  getStockMovements(filters: Record<string, string> = {}): Observable<PaginatedResponse<StockMovement>> {
    const params = new HttpParams({ fromObject: filters });
    return this.http.get<PaginatedResponse<StockMovement>>(`${environment.apiUrl}/stock-movements`, { params });
  }
}
