import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Brand, BrandPayload, PaginatedResponse } from '../models/brand.model';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class BrandService {
  private apiUrl = `${environment.apiUrl}/brands`;

  constructor(private http: HttpClient) {}

  getBrands(filters: Record<string, string> = {}): Observable<PaginatedResponse<Brand>> {
    const params = new HttpParams({ fromObject: filters });
    return this.http.get<PaginatedResponse<Brand>>(this.apiUrl, { params });
  }

  getAllBrands(): Observable<Brand[]> {
    return this.http.get<Brand[]>(this.apiUrl, { params: { all: '1' } });
  }

  createBrand(payload: BrandPayload, logo?: File): Observable<Brand> {
    const formData = this.buildFormData(payload, logo);
    return this.http.post<Brand>(this.apiUrl, formData);
  }

  updateBrand(id: number, payload: BrandPayload, logo?: File): Observable<Brand> {
    const formData = this.buildFormData(payload, logo);
    formData.append('_method', 'PUT');
    return this.http.post<Brand>(`${this.apiUrl}/${id}`, formData);
  }

  private buildFormData(payload: BrandPayload, logo?: File): FormData {
    const formData = new FormData();
    formData.append('name', payload.name);
    formData.append('is_active', payload.is_active ? '1' : '0');
    if (logo) {
      formData.append('logo', logo);
    }
    return formData;
  }

  deleteBrand(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  toggleActive(id: number): Observable<Brand> {
    return this.http.patch<Brand>(`${this.apiUrl}/${id}/toggle-active`, {});
  }
}