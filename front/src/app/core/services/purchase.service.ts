import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Purchase, PurchasePayload, PurchaseSummary } from '../models/purchase.model';

@Injectable({
  providedIn: 'root'
})
export class PurchaseService {
  private http = inject(HttpClient);
  private apiUrl = '/api/purchases';

  getPurchases(page: number = 1, search: string = '', paymentStatus: string = ''): Observable<{ data: Purchase[], current_page: number, last_page: number, total: number }> {
    let params = new HttpParams().set('page', page);
    if (search) params = params.set('search', search);
    if (paymentStatus) params = params.set('payment_status', paymentStatus);

    return this.http.get<{ data: Purchase[], current_page: number, last_page: number, total: number }>(this.apiUrl, { params });
  }

  getSummary(): Observable<PurchaseSummary> {
    return this.http.get<PurchaseSummary>('/api/purchases-summary');
  }

  getPurchase(id: number): Observable<Purchase> {
    return this.http.get<Purchase>(`${this.apiUrl}/${id}`);
  }

  createPurchase(data: PurchasePayload): Observable<Purchase> {
    return this.http.post<Purchase>(this.apiUrl, data);
  }

  updatePurchase(id: number, data: PurchasePayload): Observable<Purchase> {
    return this.http.put<Purchase>(`${this.apiUrl}/${id}`, data);
  }

  deletePurchase(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
