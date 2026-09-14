import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { MonthlyReport } from '../models/reporting.model';

@Injectable({ providedIn: 'root' })
export class ReportingService {
  private apiUrl = `${environment.apiUrl}/reporting/monthly`;

  constructor(private http: HttpClient) {}

  /**
   * `3h` : mois, trimestre ou annee. Le serveur choisit les bornes et la
   * periode de comparaison — le front n'a qu'a dire ce qu'il veut regarder.
   */
  getMonthly(
    year: number,
    unit: number,
    granularity: 'month' | 'quarter' | 'year' = 'month',
  ): Observable<MonthlyReport> {
    let params = new HttpParams()
      .set('year', year.toString())
      .set('granularity', granularity);

    if (granularity === 'quarter') params = params.set('quarter', unit.toString());
    if (granularity === 'month') params = params.set('month', unit.toString());

    return this.http.get<MonthlyReport>(this.apiUrl, { params });
  }
}
