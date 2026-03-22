import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PaymentPayload, PaymentSummary } from '../models/payment.model';

@Injectable({
  providedIn: 'root',
})
export class PaymentService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getPayments(saleId: number): Observable<PaymentSummary> {
    return this.http.get<PaymentSummary>(`${this.apiUrl}/sales/${saleId}/payments`);
  }

  addPayment(saleId: number, payload: PaymentPayload): Observable<any> {
    return this.http.post(`${this.apiUrl}/sales/${saleId}/payments`, payload);
  }

  deletePayment(saleId: number, paymentId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/sales/${saleId}/payments/${paymentId}`);
  }
}
