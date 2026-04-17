import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { PaginatedResponse, Product, ProductFilters, ProductPayload } from '../models/product.model';

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private apiUrl = `${environment.apiUrl}/products`;

  constructor(private http: HttpClient) {}

  getProducts(filters: Record<string, string> = {}): Observable<PaginatedResponse<Product>> {
    const params = new HttpParams({ fromObject: filters });
    return this.http.get<PaginatedResponse<Product>>(this.apiUrl, { params });
  }

  getFilters(): Observable<ProductFilters> {
    return this.http.get<ProductFilters>(`${this.apiUrl}-filters`);
  }

  createProduct(payload: ProductPayload): Observable<Product> {
    return this.http.post<Product>(this.apiUrl, payload);
  }

  updateProduct(id: number, payload: ProductPayload): Observable<Product> {
    return this.http.put<Product>(`${this.apiUrl}/${id}`, payload);
  }

  deleteProduct(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  toggleActive(id: number): Observable<Product> {
    return this.http.patch<Product>(`${this.apiUrl}/${id}/toggle-active`, {});
  }
}