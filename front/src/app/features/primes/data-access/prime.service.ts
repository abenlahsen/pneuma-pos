import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { PrimesResponse } from '../models/prime.model';

@Injectable({ providedIn: 'root' })
export class PrimeService {
  private apiUrl = `${environment.apiUrl}/primes-commerciaux`;

  constructor(private http: HttpClient) {}

  getPrimes(year: number, month: number): Observable<PrimesResponse> {
    const params = new HttpParams()
      .set('year', year.toString())
      .set('month', month.toString());
    return this.http.get<PrimesResponse>(this.apiUrl, { params });
  }
}
