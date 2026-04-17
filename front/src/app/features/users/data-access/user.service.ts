import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ManagedUser, UserPayload, PaginatedResponse } from '../models/user.model';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private apiUrl = `${environment.apiUrl}/users`;

  constructor(private http: HttpClient) {}

  getUsers(filters: Record<string, string | boolean> = {}): Observable<PaginatedResponse<ManagedUser> | ManagedUser[]> {
    const params = new HttpParams({ fromObject: filters as any });
    return this.http.get<PaginatedResponse<ManagedUser> | ManagedUser[]>(this.apiUrl, { params });
  }

  createUser(payload: UserPayload): Observable<ManagedUser> {
    return this.http.post<ManagedUser>(this.apiUrl, payload);
  }

  updateUser(id: number, payload: UserPayload): Observable<ManagedUser> {
    return this.http.put<ManagedUser>(`${this.apiUrl}/${id}`, payload);
  }

  deleteUser(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}