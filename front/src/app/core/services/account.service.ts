import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Account, AccountPayload, TransferPayload } from '../models/account.model';

@Injectable({
  providedIn: 'root',
})
export class AccountService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getAccounts(): Observable<Account[]> {
    return this.http.get<Account[]>(`${this.apiUrl}/accounts`);
  }

  getAccount(id: number): Observable<Account> {
    return this.http.get<Account>(`${this.apiUrl}/accounts/${id}`);
  }

  createAccount(payload: AccountPayload): Observable<Account> {
    return this.http.post<Account>(`${this.apiUrl}/accounts`, payload);
  }

  updateAccount(id: number, payload: AccountPayload): Observable<Account> {
    return this.http.put<Account>(`${this.apiUrl}/accounts/${id}`, payload);
  }

  deleteAccount(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/accounts/${id}`);
  }

  transfer(payload: TransferPayload): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/accounts/transfer`, payload);
  }
}
