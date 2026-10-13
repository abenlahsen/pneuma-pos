import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { HttpClient, HttpContext, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { BACKGROUND_REQUEST, pendingRequestsInterceptor } from './pending-requests.interceptor';
import { PendingRequestsService } from '../services/pending-requests.service';

/** Refonte 2b, étape 14a — toute requête HTTP compte, sauf les sondages de fond. */
describe('pendingRequestsInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let pending: PendingRequestsService;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(withInterceptors([pendingRequestsInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    pending = TestBed.inject(PendingRequestsService);
  });

  afterEach(() => {
    backend.verify();
    vi.useRealTimers();
  });

  it('allume l’indicateur pour une requête qui dure, et l’éteint à la réponse', () => {
    http.get('/api/sales').subscribe();
    vi.advanceTimersByTime(300);
    expect(pending.busy()).toBe(true);

    backend.expectOne('/api/sales').flush([]);

    expect(pending.busy()).toBe(false);
  });

  it('laisse hors du compte une requête marquée de fond', () => {
    const context = new HttpContext().set(BACKGROUND_REQUEST, true);
    http.get('/api/dashboard-kpi', { context }).subscribe();
    vi.advanceTimersByTime(9_000);

    expect(pending.busy()).toBe(false);
    expect(pending.slow()).toBe(false);

    backend.expectOne('/api/dashboard-kpi').flush({});
  });
});
