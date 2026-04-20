import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { CompanySettings, UpdateCompanySettingsPayload } from '../models/company-settings.model';

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  private apiUrl = `${environment.apiUrl}/settings/company`;

  constructor(private http: HttpClient) {}

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

      formData.append(key, String(value));
    });

    if (logoFile) {
      formData.append('logo', logoFile);
    }

    if (faviconFile) {
      formData.append('favicon', faviconFile);
    }

    return this.http.put<CompanySettings>(this.apiUrl, formData);
  }
}