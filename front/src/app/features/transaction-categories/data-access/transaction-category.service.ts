import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import {
  TransactionCategory,
  TransactionCategoryPayload,
  TransactionCategoryType,
} from '../models/transaction-category.model';
import { environment } from '../../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class TransactionCategoryService {
  private apiUrl = `${environment.apiUrl}/transaction-categories`;

  constructor(private http: HttpClient) {}

  getTree(type?: TransactionCategoryType, onlyActive = false): Observable<TransactionCategory[]> {
    let params = new HttpParams();
    if (type) params = params.set('type', type);
    if (onlyActive) params = params.set('only_active', '1');

    return this.http
      .get<{ data: TransactionCategory[] }>(this.apiUrl, { params })
      .pipe(map((res) => res.data));
  }

  create(payload: TransactionCategoryPayload): Observable<TransactionCategory> {
    return this.http.post<TransactionCategory>(this.apiUrl, payload);
  }

  update(id: number, payload: Partial<TransactionCategoryPayload>): Observable<TransactionCategory> {
    return this.http.put<TransactionCategory>(`${this.apiUrl}/${id}`, payload);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
