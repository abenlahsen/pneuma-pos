import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { Subject, Subscription } from 'rxjs';

import { PendingRequestsService } from './pending-requests.service';

/** Refonte 2b, étape 14a — les seuils de la maquette 21a : 300 ms, puis 8 s. */
describe('PendingRequestsService', () => {
  let pending: PendingRequestsService;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    pending = TestBed.inject(PendingRequestsService);
  });

  afterEach(() => vi.useRealTimers());

  function start(): { response: Subject<string>; subscription: Subscription } {
    const response = new Subject<string>();
    const subscription = pending.track(response).subscribe({ error: () => {} });
    return { response, subscription };
  }

  it('ne montre rien pour une requête qui répond en moins de 300 ms', () => {
    const { response } = start();
    vi.advanceTimersByTime(299);
    expect(pending.busy()).toBe(false);

    response.complete();
    vi.advanceTimersByTime(10_000);
    expect(pending.busy()).toBe(false);
    expect(pending.slow()).toBe(false);
  });

  it('passe occupé à 300 ms, puis lent à 8 s', () => {
    start();
    vi.advanceTimersByTime(300);
    expect(pending.busy()).toBe(true);
    expect(pending.slow()).toBe(false);

    vi.advanceTimersByTime(7_699);
    expect(pending.slow()).toBe(false);
    vi.advanceTimersByTime(1);
    expect(pending.slow()).toBe(true);
  });

  it('retombe dès la réponse', () => {
    const { response } = start();
    vi.advanceTimersByTime(9_000);

    response.next('ok');
    response.complete();

    expect(pending.busy()).toBe(false);
    expect(pending.slow()).toBe(false);
  });

  it('retombe aussi sur une erreur', () => {
    const { response } = start();
    vi.advanceTimersByTime(9_000);

    response.error(new Error('HTTP 500'));

    expect(pending.busy()).toBe(false);
    expect(pending.slow()).toBe(false);
  });

  it('retombe sur une requête abandonnée, comme celle que LatestRequest remplace', () => {
    const { subscription } = start();
    vi.advanceTimersByTime(9_000);

    subscription.unsubscribe();

    expect(pending.busy()).toBe(false);
    expect(pending.slow()).toBe(false);
  });

  it('reste occupé tant qu’une autre requête attend encore', () => {
    const first = start();
    const second = start();
    vi.advanceTimersByTime(400);

    first.response.complete();
    expect(pending.busy()).toBe(true);

    second.response.complete();
    expect(pending.busy()).toBe(false);
  });

  it('mesure chaque requête depuis son propre départ', () => {
    const first = start();
    vi.advanceTimersByTime(250);
    first.response.complete();

    start();
    vi.advanceTimersByTime(100);
    expect(pending.busy()).toBe(false);

    vi.advanceTimersByTime(200);
    expect(pending.busy()).toBe(true);
  });
});
