import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { shareReplay } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class CityService {
  private cities$: Observable<string[]> | null = null;

  constructor(private http: HttpClient) {}

  getCities(): Observable<string[]> {
    if (!this.cities$) {
      this.cities$ = this.http
        .get<string[]>(`${environment.apiUrl}/cities`)
        .pipe(shareReplay(1));
    }
    return this.cities$;
  }
}
