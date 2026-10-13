import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { devLatencyInterceptor } from './dev-latency.interceptor';

/** Outil de développement — étape 14 : simuler une API lente depuis la console. */
describe('devLatencyInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(withInterceptors([devLatencyInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    localStorage.removeItem('dev_api_delay_ms');
    localStorage.removeItem('dev_api_delay_match');
    backend.verify();
    vi.useRealTimers();
  });

  it('ne retarde rien sans réglage', () => {
    http.get('/api/sales').subscribe();

    backend.expectOne('/api/sales').flush([]);
  });

  it('retient la requête le temps demandé', () => {
    localStorage.setItem('dev_api_delay_ms', '2000');
    http.get('/api/sales').subscribe();

    vi.advanceTimersByTime(1_999);
    backend.expectNone('/api/sales');

    vi.advanceTimersByTime(1);
    backend.expectOne('/api/sales').flush([]);
  });

  it('ne retarde que les adresses qui contiennent le filtre', () => {
    localStorage.setItem('dev_api_delay_ms', '2000');
    localStorage.setItem('dev_api_delay_match', '/sales');

    http.get('/api/clients').subscribe();
    backend.expectOne('/api/clients').flush([]);

    http.get('/api/sales').subscribe();
    backend.expectNone('/api/sales');
    vi.advanceTimersByTime(2_000);
    backend.expectOne('/api/sales').flush([]);
  });
});
