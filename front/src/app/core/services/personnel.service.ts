import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Personnel, PersonnelPayload, PaginatedResponse } from '../models/personnel.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class PersonnelService {
  private apiUrl = `${environment.apiUrl}/personnels`;

  constructor(private http: HttpClient) {}

  getPersonnels(filters: Record<string, string> = {}): Observable<PaginatedResponse<Personnel>> {
    const params = new HttpParams({ fromObject: filters });
    return this.http.get<PaginatedResponse<Personnel>>(this.apiUrl, { params });
  }

  getAllPersonnels(): Observable<Personnel[]> {
    const params = new HttpParams().set('all', '1');
    return this.http.get<Personnel[]>(this.apiUrl, { params });
  }

  createPersonnel(payload: PersonnelPayload): Observable<Personnel> {
    return this.http.post<Personnel>(this.apiUrl, payload);
  }

  updatePersonnel(id: number, payload: PersonnelPayload): Observable<Personnel> {
    return this.http.put<Personnel>(`${this.apiUrl}/${id}`, payload);
  }
  deletePersonnel(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
