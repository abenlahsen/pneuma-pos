import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  Supplier,
  SupplierPayload,
  PaginatedResponse,
  SupplierProfileResponse,
  SupplierStatementResponse,
  UnpaidPurchaseRow,
  SupplierPaymentPayload,
  SupplierUnpaidSummary,
} from '../models/supplier.model';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SupplierService {
  private apiUrl = `${environment.apiUrl}/suppliers`;

  constructor(private http: HttpClient) {}

  getSuppliers(filters: Record<string, string | boolean> = {}): Observable<PaginatedResponse<Supplier> | Supplier[]> {
    const params = new HttpParams({ fromObject: filters as any });
    return this.http.get<PaginatedResponse<Supplier> | Supplier[]>(this.apiUrl, { params });
  }

  createSupplier(payload: SupplierPayload): Observable<Supplier> {
    return this.http.post<Supplier>(this.apiUrl, payload);
  }

  updateSupplier(id: number, payload: SupplierPayload): Observable<Supplier> {
    return this.http.put<Supplier>(`${this.apiUrl}/${id}`, payload);
  }

  deleteSupplier(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  getSupplier(id: number): Observable<Supplier> {
    return this.http.get<Supplier>(`${this.apiUrl}/${id}`);
  }

  getSupplierProfile(id: number): Observable<SupplierProfileResponse> {
    return this.http.get<SupplierProfileResponse>(`${this.apiUrl}/${id}/profile`);
  }

  getSupplierStatement(id: number): Observable<SupplierStatementResponse> {
    return this.http.get<SupplierStatementResponse>(`${this.apiUrl}/${id}/statement`);
  }

  getUnpaidPurchases(id: number): Observable<{ purchases: UnpaidPurchaseRow[] }> {
    return this.http.get<{ purchases: UnpaidPurchaseRow[] }>(`${this.apiUrl}/${id}/unpaid-purchases`);
  }

  getUnpaidSummary(): Observable<SupplierUnpaidSummary> {
    return this.http.get<SupplierUnpaidSummary>('/api/suppliers-summary');
  }

  createSupplierPayment(id: number, payload: SupplierPaymentPayload): Observable<unknown> {
    return this.http.post(`${this.apiUrl}/${id}/payments`, payload);
  }

  deleteSupplierPayment(supplierId: number, paymentId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${supplierId}/payments/${paymentId}`);
  }
}