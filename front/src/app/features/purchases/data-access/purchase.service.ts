import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  Purchase,
  PurchasePayload,
  PurchaseSummary,
  PurchasePayment,
  PurchasePaymentSummary,
  PurchasePaymentDetail,
} from '../models/purchase.model';
import { PurchaseStatus } from '../../../core/constants/status.constants';

@Injectable({
  providedIn: 'root',
})
export class PurchaseService {
  private http = inject(HttpClient);
  private apiUrl = '/api/purchases';

  getPurchases(filters: Record<string, string> = {}): Observable<{
    data: Purchase[];
    current_page: number;
    last_page: number;
    total: number;
  }> {
    let params = new HttpParams();

    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        params = params.set(key, value);
      }
    });

    return this.http.get<{
      data: Purchase[];
      current_page: number;
      last_page: number;
      total: number;
    }>(this.apiUrl, { params });
  }

  getSummary(filters: Record<string, string> = {}): Observable<PurchaseSummary> {
    let params = new HttpParams();

    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        params = params.set(key, value);
      }
    });

    return this.http.get<PurchaseSummary>('/api/purchases-summary', { params });
  }

  getFilters(): Observable<{
    suppliers: { id: number; name: string }[];
    commercials: { id: number; name: string }[];
  }> {
    return this.http.get<{
      suppliers: { id: number; name: string }[];
      commercials: { id: number; name: string }[];
    }>('/api/purchases-filters');
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

  patchStatus(id: number, status: PurchaseStatus): Observable<{ status: PurchaseStatus }> {
    return this.http.patch<{ status: PurchaseStatus }>(`${this.apiUrl}/${id}/status`, { status });
  }

  deletePurchase(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  getPurchasePayments(purchaseId: number): Observable<PurchasePaymentSummary> {
    return this.http.get<PurchasePaymentSummary>(`${this.apiUrl}/${purchaseId}/payments`);
  }

  addPurchasePayment(purchaseId: number, data: any): Observable<PurchasePayment> {
    return this.http.post<PurchasePayment>(`${this.apiUrl}/${purchaseId}/payments`, data);
  }

  deletePurchasePayment(purchaseId: number, paymentId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${purchaseId}/payments/${paymentId}`);
  }

  getPaymentDetail(paymentId: number): Observable<PurchasePaymentDetail> {
    return this.http.get<PurchasePaymentDetail>(`/api/purchase-payments/${paymentId}`);
  }

  exportPurchases(filters: Record<string, string> = {}): Observable<Blob> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params = params.set(key, value);
    });
    return this.http.get(`${this.apiUrl}/export`, { params, responseType: 'blob' });
  }
}
