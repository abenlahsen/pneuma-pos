import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface BusinessDate {
  /** Le jour au Maroc, au format YYYY-MM-DD. */
  date: string;
  timezone: string;
}

/**
 * La date du jour du magasin, à l'heure du Maroc, selon le serveur.
 *
 * Le navigateur ne fait pas foi : ses règles de fuseau peuvent se tromper
 * d'une heure sur le Maroc, et proposer demain entre minuit et 1 h. Pas de
 * cache : la date change à minuit, on la relit à chaque besoin.
 */
@Injectable({ providedIn: 'root' })
export class BusinessDateService {
  private readonly http = inject(HttpClient);

  get(): Observable<BusinessDate> {
    return this.http.get<BusinessDate>(`${environment.apiUrl}/business-date`);
  }
}
