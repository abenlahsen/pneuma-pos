import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  PaginatedShipmentChangeRequests,
  ShipmentChangeRequest,
  ShipmentChangeRequestPayload,
} from '../models/shipment-change.model';
import { ShipmentChangeStatus } from '../../../core/constants/status.constants';
import { environment } from '../../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ShipmentChangeService {
  private apiUrl = `${environment.apiUrl}/shipment-change-requests`;

  constructor(private http: HttpClient) {}

  getForSale(saleId: number): Observable<{ data: ShipmentChangeRequest[] }> {
    return this.http.get<{ data: ShipmentChangeRequest[] }>(
      `${environment.apiUrl}/sales/${saleId}/shipment-change-requests`,
    );
  }

  create(saleId: number, payload: ShipmentChangeRequestPayload): Observable<ShipmentChangeRequest> {
    return this.http.post<ShipmentChangeRequest>(
      `${environment.apiUrl}/sales/${saleId}/shipment-change-requests`,
      payload,
    );
  }

  update(id: number, payload: ShipmentChangeRequestPayload): Observable<ShipmentChangeRequest> {
    return this.http.put<ShipmentChangeRequest>(`${this.apiUrl}/${id}`, payload);
  }

  updateStatus(
    id: number,
    status: ShipmentChangeStatus,
    carrierResponse?: string | null,
  ): Observable<ShipmentChangeRequest> {
    return this.http.patch<ShipmentChangeRequest>(`${this.apiUrl}/${id}/status`, {
      status,
      carrier_response: carrierResponse ?? null,
    });
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
