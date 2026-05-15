import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Vehicle, VehiclePayload } from '../models/vehicle.model';

@Injectable({ providedIn: 'root' })
export class VehicleService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/clients`;

  getVehiclesForClient(clientId: number, activeOnly = false): Observable<Vehicle[]> {
    const params: Record<string, string> = {};
    if (activeOnly) params['active_only'] = '1';
    return this.http.get<Vehicle[]>(`${this.base}/${clientId}/vehicles`, { params });
  }

  createVehicle(clientId: number, payload: VehiclePayload): Observable<Vehicle> {
    return this.http.post<Vehicle>(`${this.base}/${clientId}/vehicles`, payload);
  }

  updateVehicle(vehicleId: number, payload: Partial<VehiclePayload>): Observable<Vehicle> {
    return this.http.put<Vehicle>(`${this.base}/vehicles/${vehicleId}`, payload);
  }

  deleteVehicle(vehicleId: number): Observable<{ deactivated?: boolean; message?: string } | void> {
    return this.http.delete<{ deactivated?: boolean; message?: string } | void>(
      `${this.base}/vehicles/${vehicleId}`
    );
  }

  formatDisplay(v: Vehicle): string {
    const month = String(v.circulation_month).padStart(2, '0');
    return `${v.brand} ${v.model_name} — ${v.plate} (${month}/${v.circulation_year})`;
  }
}
