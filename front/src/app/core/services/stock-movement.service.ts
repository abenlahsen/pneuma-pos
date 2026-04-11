import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { StockMovement, StockMovementFilters } from '../models/stock-movement.model';
import { PaginatedResponse } from '../models/sale.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class StockMovementService {
  private apiUrl = `${environment.apiUrl}/stock-movements`;

  constructor(private http: HttpClient) {}

  getMovements(filters: StockMovementFilters = {}): Observable<PaginatedResponse<StockMovement>> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    });
    return this.http.get<PaginatedResponse<StockMovement>>(this.apiUrl, { params });
  }
}
