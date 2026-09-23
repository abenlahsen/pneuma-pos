import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { CompanySettings, UpdateCompanySettingsPayload } from '../models/company-settings.model';

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  private apiUrl = `${environment.apiUrl}/settings/company`;

  constructor(private http: HttpClient) {}

  /**
   * Refonte 2b, 17a : la liste de gauche des Paramètres affiche un compte à
   * côté des référentiels. On demande une seule ligne et on lit le total de la
   * pagination, plutôt que de charger un référentiel entier pour le compter.
   */
  private countOf(path: string): Observable<number> {
    return this.http
      .get<{ total?: number; data?: unknown[] }>(`${environment.apiUrl}/${path}?per_page=1`)
      .pipe(map((response) => response.total ?? response.data?.length ?? 0));
  }

  countBrands(): Observable<number> {
    return this.countOf('brands');
  }

  countCarriers(): Observable<number> {
    return this.countOf('carriers');
  }

  countUsers(): Observable<number> {
    return this.countOf('users');
  }

  /**
   * Les rôles et les catégories ne sont pas paginés : leurs endpoints
   * renvoient une liste entière, dont on compte les entrées.
   */
  countRoles(): Observable<number> {
    return this.http
      .get<{ data?: unknown[] } | unknown[]>(`${environment.apiUrl}/roles`)
      .pipe(map((response) => (Array.isArray(response) ? response.length : response.data?.length ?? 0)));
  }

  countTransactionCategories(): Observable<number> {
    return this.http
      .get<{ data?: unknown[] } | unknown[]>(`${environment.apiUrl}/transaction-categories`)
      .pipe(map((response) => (Array.isArray(response) ? response.length : response.data?.length ?? 0)));
  }

  getCompanySettings(): Observable<CompanySettings> {
    return this.http.get<CompanySettings>(this.apiUrl);
  }

  updateCompanySettings(payload: UpdateCompanySettingsPayload, logoFile?: File | null, faviconFile?: File | null): Observable<CompanySettings> {
    const formData = new FormData();

    Object.entries(payload).forEach(([key, value]) => {
      if (value === null || value === undefined) {
        return;
      }

      if (typeof value === 'boolean') {
        formData.append(key, value ? '1' : '0');
        return;
      }

      // Les listes (jours de fermeture, jours fériés) partent en JSON et sont
      // décodées par la requête côté Laravel. `closed_weekdays[]` répété ne
      // saurait pas dire « aucun jour » : sans entrée, la clé disparaîtrait et
      // vaudrait « ne change rien », donc on ne pourrait jamais vider la liste.
      if (Array.isArray(value)) {
        formData.append(key, JSON.stringify(value));
        return;
      }

      formData.append(key, String(value));
    });

    if (logoFile) {
      formData.append('logo', logoFile);
    }

    if (faviconFile) {
      formData.append('favicon', faviconFile);
    }

    // PHP only parses multipart/form-data for POST — use method spoofing
    // so files are accessible via $request->file() in Laravel.
    formData.append('_method', 'PUT');
    return this.http.post<CompanySettings>(this.apiUrl, formData);
  }
}