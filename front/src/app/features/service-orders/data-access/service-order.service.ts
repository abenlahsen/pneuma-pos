import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  PartSearchResult,
  ServiceItem,
  ServiceItemPayload,
  ServiceOrder,
  ServiceOrderFilters,
  ServiceOrderPayload,
  ServiceOrderSummary,
  ServicePayment,
  ServicePaymentPayload,
} from '../../../core/models/service-order.model';

export interface PaginatedServiceOrders {
  data: ServiceOrder[];
  total: number;
  current_page: number;
  last_page: number;
  per_page: number;
}

export interface ServicePaymentSummary {
  payments: ServicePayment[];
  total_paid: number;
  total_amount: number;
  remaining: number;
  payment_status: string;
}

@Injectable({ providedIn: 'root' })
export class ServiceOrderService {
  private apiUrl = `${environment.apiUrl}/service-orders`;

  constructor(private http: HttpClient) {}

  getServiceOrders(filters: Record<string, string> = {}): Observable<PaginatedServiceOrders> {
    const params = new HttpParams({ fromObject: filters });
    return this.http.get<PaginatedServiceOrders>(this.apiUrl, { params });
  }

  getSummary(filters: Record<string, string> = {}): Observable<ServiceOrderSummary> {
    const params = new HttpParams({ fromObject: filters });
    return this.http.get<ServiceOrderSummary>(`${environment.apiUrl}/service-orders-summary`, { params });
  }

  getFilters(): Observable<ServiceOrderFilters> {
    return this.http.get<ServiceOrderFilters>(`${environment.apiUrl}/service-orders-filters`);
  }

  getServiceOrder(id: number): Observable<ServiceOrder> {
    return this.http.get<ServiceOrder>(`${this.apiUrl}/${id}`);
  }

  createServiceOrder(payload: ServiceOrderPayload): Observable<ServiceOrder> {
    return this.http.post<ServiceOrder>(this.apiUrl, payload);
  }

  updateServiceOrder(id: number, payload: ServiceOrderPayload): Observable<ServiceOrder> {
    return this.http.put<ServiceOrder>(`${this.apiUrl}/${id}`, payload);
  }

  deleteServiceOrder(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  getPayments(orderId: number): Observable<ServicePaymentSummary> {
    return this.http.get<ServicePaymentSummary>(`${this.apiUrl}/${orderId}/payments`);
  }

  addPayment(orderId: number, payload: ServicePaymentPayload): Observable<ServicePayment> {
    return this.http.post<ServicePayment>(`${this.apiUrl}/${orderId}/payments`, payload);
  }

  deletePayment(orderId: number, paymentId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${orderId}/payments/${paymentId}`);
  }

  exportOrders(filters: Record<string, string> = {}): Observable<Blob> {
    const params = new HttpParams({ fromObject: filters });
    return this.http.get(`${this.apiUrl}/export`, { params, responseType: 'blob' });
  }

  searchParts(query: string): Observable<PartSearchResult[]> {
    return this.http.get<PartSearchResult[]>(`${environment.apiUrl}/service-orders-parts-search`, {
      params: { q: query },
    });
  }

  syncItems(orderId: number, items: ServiceItemPayload[]): Observable<ServiceOrder> {
    return this.http.post<ServiceOrder>(`${this.apiUrl}/${orderId}/items/sync`, { items });
  }

  addItem(orderId: number, payload: ServiceItemPayload): Observable<ServiceItem> {
    return this.http.post<ServiceItem>(`${this.apiUrl}/${orderId}/items`, payload);
  }

  updateItem(orderId: number, itemId: number, payload: ServiceItemPayload): Observable<ServiceItem> {
    return this.http.put<ServiceItem>(`${this.apiUrl}/${orderId}/items/${itemId}`, payload);
  }

  deleteItem(orderId: number, itemId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${orderId}/items/${itemId}`);
  }
}
