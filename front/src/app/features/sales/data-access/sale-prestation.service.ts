import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { shareReplay } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { SalePrestationCatalog } from '../models/sale.model';

@Injectable({ providedIn: 'root' })
export class SalePrestationService {
  private catalog$: Observable<SalePrestationCatalog> | null = null;

  constructor(private http: HttpClient) {}

  getCatalog(): Observable<SalePrestationCatalog> {
    if (!this.catalog$) {
      this.catalog$ = this.http
        .get<SalePrestationCatalog>(`${environment.apiUrl}/sale-prestations`)
        .pipe(shareReplay(1));
    }
    return this.catalog$;
  }
}
