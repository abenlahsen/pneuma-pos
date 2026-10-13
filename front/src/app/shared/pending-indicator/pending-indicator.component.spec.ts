import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { Subject } from 'rxjs';

import { PendingIndicatorComponent } from './pending-indicator.component';
import { PendingRequestsService } from '../../core/services/pending-requests.service';

/** Refonte 2b, étape 14a — la barre haute et le bandeau « Toujours en cours… ». */
describe('PendingIndicatorComponent', () => {
  let pending: PendingRequestsService;
  let fixture: ComponentFixture<PendingIndicatorComponent>;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    pending = TestBed.inject(PendingRequestsService);
    fixture = TestBed.createComponent(PendingIndicatorComponent);
  });

  afterEach(() => vi.useRealTimers());

  function request(): Subject<void> {
    const response = new Subject<void>();
    pending.track(response).subscribe();
    return response;
  }

  function view(): HTMLElement {
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('ne montre rien au repos', () => {
    expect(view().querySelector('.pi-bar')).toBeNull();
    expect(view().textContent).not.toContain('Toujours en cours');
  });

  it('fait défiler la barre haute dès 300 ms, sans bandeau', () => {
    request();
    vi.advanceTimersByTime(300);

    expect(view().querySelector('.pi-bar')).not.toBeNull();
    expect(view().textContent).not.toContain('Toujours en cours');
  });

  it('ajoute le bandeau après 8 s, et retire tout à la réponse', () => {
    const response = request();
    vi.advanceTimersByTime(8_000);

    expect(view().textContent).toContain('Toujours en cours…');
    expect(view().textContent).toContain("N'actualisez pas la page : votre saisie est conservée.");

    response.complete();

    expect(view().textContent).not.toContain('Toujours en cours');
    expect(view().querySelector('.pi-bar')).toBeNull();
  });

  it('annonce le bandeau dans une région présente avant lui', () => {
    // Une région live insérée en même temps que son texte n'est pas lue par
    // tous les lecteurs d'écran : elle doit exister avant que le texte arrive.
    const region = view().querySelector('[aria-live="polite"]');
    expect(region).not.toBeNull();

    request();
    vi.advanceTimersByTime(8_000);

    expect(view().querySelector('[aria-live="polite"]')).toBe(region);
    expect(region?.textContent).toContain('Toujours en cours…');
  });
});
