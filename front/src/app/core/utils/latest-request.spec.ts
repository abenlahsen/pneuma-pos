import { Subject, finalize } from 'rxjs';
import { LatestRequest } from './latest-request';

describe('LatestRequest', () => {
  it('abandonne la requête en vol quand une nouvelle part', () => {
    const request = new LatestRequest();
    const first = new Subject<string>();
    const second = new Subject<string>();
    const seen: string[] = [];

    request.run(first, { next: v => seen.push(v) });
    request.run(second, { next: v => seen.push(v) });

    expect(first.observed).toBe(false);
    second.next('récente');
    first.next('périmée');
    expect(seen).toEqual(['récente']);
  });

  it('accepte une simple fonction de réponse', () => {
    const request = new LatestRequest();
    const source = new Subject<number>();
    const seen: number[] = [];
    request.run(source, v => seen.push(v));
    source.next(3);
    expect(seen).toEqual([3]);
  });

  it('dit si une requête est en vol, et cancel() l\'abandonne', () => {
    const request = new LatestRequest();
    const source = new Subject<number>();
    expect(request.pending).toBe(false);
    request.run(source, () => {});
    expect(request.pending).toBe(true);
    request.cancel();
    expect(request.pending).toBe(false);
    expect(source.observed).toBe(false);
  });

  it('n\'est plus en vol une fois la réponse arrivée', () => {
    const request = new LatestRequest();
    const source = new Subject<number>();
    request.run(source, () => {});
    source.next(1);
    source.complete();
    expect(request.pending).toBe(false);
  });

  it('exécute le finalize de la requête abandonnée — d\'où cancel() avant de lever un indicateur', () => {
    const request = new LatestRequest();
    let finalized = 0;
    request.run(new Subject<number>().pipe(finalize(() => finalized++)), () => {});
    request.run(new Subject<number>(), () => {});
    expect(finalized).toBe(1);
  });
});
