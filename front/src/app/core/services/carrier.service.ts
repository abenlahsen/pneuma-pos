import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Carrier, CarrierPayload, PaginatedResponse } from '../models/carrier.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class CarrierService {
  private apiUrl = `${environment.apiUrl}/carriers`;

  constructor(private http: HttpClient) {}

  getCarriers(filters: Record<string, string | boolean> = {}): Observable<PaginatedResponse<Carrier> | Carrier[]> {
    const params = new HttpParams({ fromObject: filters as any });
    return this.http.get<PaginatedResponse<Carrier> | Carrier[]>(this.apiUrl, { params });
  }

  createCarrier(payload: CarrierPayload): Observable<Carrier> {
    return this.http.post<Carrier>(this.apiUrl, payload);
  }

  updateCarrier(id: number, payload: CarrierPayload): Observable<Carrier> {
    return this.http.put<Carrier>(`${this.apiUrl}/${id}`, payload);
  }

  deleteCarrier(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
