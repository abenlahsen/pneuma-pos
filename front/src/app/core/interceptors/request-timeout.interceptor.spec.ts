import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import {
  HttpClient,
  HttpContext,
  HttpErrorResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { REQUEST_TIMEOUT_MS, requestTimeoutInterceptor } from './request-timeout.interceptor';
import { describeLoadError } from '../../shared/list-state';

/** Refonte 2b, étape 14a — au-delà de 30 s, la requête est abandonnée. */
describe('requestTimeoutInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(withInterceptors([requestTimeoutInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    backend.verify();
    vi.useRealTimers();
  });

  it('abandonne une lecture au bout de 30 s', () => {
    let failure: unknown;
    http.get('/api/sales').subscribe({ error: (e) => (failure = e) });
    const request = backend.expectOne('/api/sales');

    vi.advanceTimersByTime(29_999);
    expect(failure).toBeUndefined();
    expect(request.cancelled).toBe(false);

    vi.advanceTimersByTime(1);
    expect(request.cancelled).toBe(true);
    expect(failure).toBeInstanceOf(HttpErrorResponse);
  });

  it('donne à l’état d’erreur de 8c une cause qui parle du délai', () => {
    let failure: unknown;
    http.get('/api/sales').subscribe({ error: (e) => (failure = e) });
    backend.expectOne('/api/sales');
    vi.advanceTimersByTime(30_000);

    expect(describeLoadError(failure).cause).toBe("Le serveur n'a pas répondu en 30 secondes.");
  });

  it('prévient qu’un enregistrement abandonné a pu aboutir quand même', () => {
    let read: HttpErrorResponse | undefined;
    let write: HttpErrorResponse | undefined;
    http.get('/api/sales/12').subscribe({ error: (e) => (read = e) });
    http.post('/api/sales/12/payments', { amount: 100 }).subscribe({ error: (e) => (write = e) });
    backend.expectOne('/api/sales/12');
    backend.expectOne('/api/sales/12/payments');

    vi.advanceTimersByTime(30_000);

    // Le navigateur abandonne, pas le serveur : PHP peut finir et valider
    // l'écriture. Relancer à l'aveugle créerait un second paiement.
    expect(write?.error?.message).toContain('a pu aboutir');
    expect(read?.error?.message).not.toContain('a pu aboutir');
  });

  it('ne touche pas une réponse arrivée à temps', () => {
    let result: unknown;
    let failure: unknown;
    http.get('/api/sales').subscribe({ next: (r) => (result = r), error: (e) => (failure = e) });

    vi.advanceTimersByTime(29_000);
    backend.expectOne('/api/sales').flush({ data: [] });
    vi.advanceTimersByTime(10_000);

    expect(result).toEqual({ data: [] });
    expect(failure).toBeUndefined();
  });

  it('laisse un envoi de fichier dépasser 30 s', () => {
    let result: unknown;
    http.post('/api/stocks/import', new FormData()).subscribe((r) => (result = r));
    const request = backend.expectOne('/api/stocks/import');

    vi.advanceTimersByTime(120_000);
    expect(request.cancelled).toBe(false);

    request.flush({ imported: 3 });
    expect(result).toEqual({ imported: 3 });
  });

  it('applique le délai propre à une requête, ou aucun', () => {
    let shortFailure: unknown;
    http
      .get('/api/business-date', { context: new HttpContext().set(REQUEST_TIMEOUT_MS, 5_000) })
      .subscribe({ error: (e) => (shortFailure = e) });
    http
      .get('/api/sales/export', { context: new HttpContext().set(REQUEST_TIMEOUT_MS, null) })
      .subscribe();
    const short = backend.expectOne('/api/business-date');
    const unlimited = backend.expectOne('/api/sales/export');

    vi.advanceTimersByTime(5_000);
    expect(short.cancelled).toBe(true);
    expect(describeLoadError(shortFailure).cause).toBe("Le serveur n'a pas répondu en 5 secondes.");

    vi.advanceTimersByTime(120_000);
    expect(unlimited.cancelled).toBe(false);
    unlimited.flush({});
  });
});
