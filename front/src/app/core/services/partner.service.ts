import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Partner, PartnerPayload, PaginatedResponse } from '../models/partner.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class PartnerService {
  private apiUrl = `${environment.apiUrl}/partners`;

  constructor(private http: HttpClient) {}

  getPartners(filters: Record<string, string | boolean> = {}): Observable<PaginatedResponse<Partner> | Partner[]> {
    const params = new HttpParams({ fromObject: filters as any });
    return this.http.get<PaginatedResponse<Partner> | Partner[]>(this.apiUrl, { params });
  }

  createPartner(payload: PartnerPayload): Observable<Partner> {
    return this.http.post<Partner>(this.apiUrl, payload);
  }

  updatePartner(id: number, payload: PartnerPayload): Observable<Partner> {
    return this.http.put<Partner>(`${this.apiUrl}/${id}`, payload);
  }

  deletePartner(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
