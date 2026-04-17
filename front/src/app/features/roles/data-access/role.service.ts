import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { PaginatedResponse, Permission, Role, RolePayload } from '../models/role.model';

@Injectable({
  providedIn: 'root'
})
export class RoleService {
  private apiUrl = `${environment.apiUrl}/roles`;
  private permissionsUrl = `${environment.apiUrl}/permissions`;

  constructor(private http: HttpClient) {}

  getRoles(filters: Record<string, string | boolean> = {}): Observable<PaginatedResponse<Role> | Role[]> {
    const params = new HttpParams({ fromObject: filters as any });
    return this.http.get<PaginatedResponse<Role> | Role[]>(this.apiUrl, { params });
  }

  getRole(id: number): Observable<Role> {
    return this.http.get<Role>(`${this.apiUrl}/${id}`);
  }

  createRole(payload: RolePayload): Observable<Role> {
    return this.http.post<Role>(this.apiUrl, payload);
  }

  updateRole(id: number, payload: RolePayload): Observable<Role> {
    return this.http.put<Role>(`${this.apiUrl}/${id}`, payload);
  }

  deleteRole(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  assignPermissions(roleId: number, permissionIds: number[]): Observable<Role> {
    return this.http.put<Role>(`${this.apiUrl}/${roleId}/permissions`, { permissions: permissionIds });
  }

  getPermissions(filters: Record<string, string | boolean> = {}): Observable<PaginatedResponse<Permission> | Permission[]> {
    const params = new HttpParams({ fromObject: filters as any });
    return this.http.get<PaginatedResponse<Permission> | Permission[]>(this.permissionsUrl, { params });
  }

  createPermission(name: string): Observable<Permission> {
    return this.http.post<Permission>(this.permissionsUrl, { name });
  }

  deletePermission(id: number): Observable<void> {
    return this.http.delete<void>(`${this.permissionsUrl}/${id}`);
  }
}