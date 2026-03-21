import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Transaction,
  TransactionPayload,
  TransactionSummary,
  TransactionFilters,
  PaginatedResponse,
} from '../models/transaction.model';

@Injectable({
  providedIn: 'root',
})
export class CashFlowService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getTransactions(filters: Record<string, string> = {}): Observable<PaginatedResponse<Transaction>> {
    let params = new HttpParams();
    Object.keys(filters).forEach((key) => {
      if (filters[key]) {
        params = params.set(key, filters[key]);
      }
    });
    return this.http.get<PaginatedResponse<Transaction>>(`${this.apiUrl}/transactions`, { params });
  }

  getTransaction(id: number): Observable<Transaction> {
    return this.http.get<Transaction>(`${this.apiUrl}/transactions/${id}`);
  }

  createTransaction(payload: TransactionPayload): Observable<Transaction> {
    return this.http.post<Transaction>(`${this.apiUrl}/transactions`, payload);
  }

  updateTransaction(id: number, payload: TransactionPayload): Observable<Transaction> {
    return this.http.put<Transaction>(`${this.apiUrl}/transactions/${id}`, payload);
  }

  deleteTransaction(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/transactions/${id}`);
  }

  getSummary(filters: Record<string, string> = {}): Observable<TransactionSummary> {
    let params = new HttpParams();
    Object.keys(filters).forEach((key) => {
      if (filters[key]) {
        params = params.set(key, filters[key]);
      }
    });
    return this.http.get<TransactionSummary>(`${this.apiUrl}/transactions-summary`, { params });
  }

  getFilters(): Observable<TransactionFilters> {
    return this.http.get<TransactionFilters>(`${this.apiUrl}/transactions-filters`);
  }
}
