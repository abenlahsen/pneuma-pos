import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ActivityLog, ActivityLogFilters, ActivityLogParams } from '../models/activity-log.model';

interface PaginatedResponse<T> {
  data: T[];
  current_page: number;
  last_page: number;
  total: number;
  per_page: number;
}

@Injectable({ providedIn: 'root' })
export class ActivityLogService {
  private readonly baseUrl = '/api/activity-logs';

  constructor(private http: HttpClient) {}

  getLogs(params: ActivityLogParams = {}): Observable<PaginatedResponse<ActivityLog>> {
    let httpParams = new HttpParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        httpParams = httpParams.set(key, String(value));
      }
    });
    return this.http.get<PaginatedResponse<ActivityLog>>(this.baseUrl, { params: httpParams });
  }

  getFilters(): Observable<ActivityLogFilters> {
    return this.http.get<ActivityLogFilters>(`${this.baseUrl}-filters`);
  }
}
