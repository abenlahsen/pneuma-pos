import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';

import { ListEmptyComponent } from './list-empty.component';
import { ListErrorComponent } from './list-error.component';
import { RowLockComponent } from './row-lock.component';
import { SkeletonCellsComponent, SkeletonRowComponent } from './skeleton-row.component';
import { describeLoadError } from './load-error';
import { frenchDate } from './filter-label';
import type { ActiveFilter } from './active-filter.model';

/** Refonte 2b, §14c — les quatre états manquants des listes. */

function setup() {
  TestBed.configureTestingModule({
    providers: [provideZonelessChangeDetection()],
  });
}

describe('ListEmptyComponent', () => {
  beforeEach(setup);

  function render(filters: ActiveFilter[]) {
    const fixture = TestBed.createComponent(ListEmptyComponent);
    fixture.componentRef.setInput('blankTitle', 'Aucune vente enregistrée.');
    fixture.componentRef.setInput('noMatchTitle', 'Aucune vente ne correspond');
    fixture.componentRef.setInput('filters', filters);
    fixture.detectChanges();
    return fixture;
  }

  it('shows the blank title when nothing is filtered', () => {
    const text = render([]).nativeElement.textContent;

    expect(text).toContain('Aucune vente enregistrée.');
    expect(text).not.toContain('ne correspond');
  });

  it('names the active filters instead of a bare "aucun résultat"', () => {
    const text = render([
      { label: 'septembre 2026', clear: vi.fn() },
      { label: 'K. Amrani', clear: vi.fn() },
      { label: 'non payé', clear: vi.fn() },
    ]).nativeElement.textContent;

    expect(text).toContain('Aucune vente ne correspond');
    expect(text).toContain('3 filtres sont actifs');
    expect(text).toContain('septembre 2026, K. Amrani, non payé');
  });

  it('accords the sentence for a single filter', () => {
    const text = render([{ label: 'non payé', clear: vi.fn() }]).nativeElement.textContent;

    expect(text).toContain('1 filtre est actif');
  });

  it('offers one removal button per filter, plus "Tout effacer"', () => {
    const fixture = render([
      { label: 'non payé', clear: vi.fn() },
      { label: 'K. Amrani', clear: vi.fn() },
    ]);
    const buttons: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('button'));

    expect(buttons).toHaveLength(3);
    expect(buttons[0].textContent).toContain('Retirer');
    expect(buttons[2].textContent).toContain('Tout effacer');
  });

  it('calls that filter\'s own clear callback, not the others', () => {
    const first = vi.fn();
    const second = vi.fn();
    const fixture = render([
      { label: 'non payé', clear: first },
      { label: 'K. Amrani', clear: second },
    ]);

    fixture.nativeElement.querySelectorAll('button')[0].click();

    expect(first).toHaveBeenCalledOnce();
    expect(second).not.toHaveBeenCalled();
  });

  it('emits clearAll from the "Tout effacer" button', () => {
    const fixture = render([{ label: 'non payé', clear: vi.fn() }]);
    const seen = vi.fn();
    fixture.componentInstance.clearAll.subscribe(seen);

    fixture.nativeElement.querySelector('.le-chip--all').click();

    expect(seen).toHaveBeenCalledOnce();
  });
});

describe('ListErrorComponent', () => {
  beforeEach(setup);

  function render(inputs: Record<string, unknown> = {}) {
    const fixture = TestBed.createComponent(ListErrorComponent);
    fixture.componentRef.setInput('title', "Les ventes n'ont pas pu être chargées.");
    fixture.componentRef.setInput('cause', "Le serveur n'a pas répondu.");
    Object.entries(inputs).forEach(([key, value]) => fixture.componentRef.setInput(key, value));
    fixture.detectChanges();
    return fixture;
  }

  it('says what failed and what is preserved', () => {
    const text = render().nativeElement.textContent;

    expect(text).toContain("Les ventes n'ont pas pu être chargées.");
    expect(text).toContain("Le serveur n'a pas répondu.");
    expect(text).toContain('Vos filtres sont conservés.');
  });

  it('keeps the technical detail available but folded away', () => {
    const fixture = render({ detail: 'HTTP 500 Internal Server Error' });

    expect(fixture.nativeElement.textContent).not.toContain('HTTP 500');

    fixture.nativeElement.querySelector('.lx-toggle').click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('HTTP 500');
  });

  it('offers no detail toggle when there is no detail', () => {
    expect(render().nativeElement.querySelector('.lx-toggle')).toBeNull();
  });

  it('emits retry — the retry is manual, never automatic', () => {
    const fixture = render();
    const seen = vi.fn();
    fixture.componentInstance.retry.subscribe(seen);

    fixture.nativeElement.querySelector('.lx-retry').click();

    expect(seen).toHaveBeenCalledOnce();
  });

  it('stamps the data still on screen with its time', () => {
    const fixture = render({ lastLoadedAt: new Date(2026, 8, 18, 11, 48) });

    expect(fixture.nativeElement.textContent).toContain('11:48');
  });

  it('omits the stamp when nothing was ever loaded', () => {
    expect(render().nativeElement.querySelector('.lx-stamp')).toBeNull();
  });
});

describe('SkeletonRowComponent', () => {
  beforeEach(setup);

  it('draws one bar per column so the row keeps its real widths', () => {
    const fixture = TestBed.createComponent(SkeletonRowComponent);
    fixture.componentRef.setInput('cells', 9);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.sk-bar')).toHaveLength(9);
  });

  it('gives the same widths on every render — no flicker between change detections', () => {
    const fixture = TestBed.createComponent(SkeletonRowComponent);
    fixture.componentRef.setInput('cells', 5);
    fixture.detectChanges();
    const first = fixture.componentInstance.widths();

    fixture.detectChanges();

    expect(fixture.componentInstance.widths()).toEqual(first);
  });

  it('offsets the pattern per row so the block is not a regular checkerboard', () => {
    const fixture = TestBed.createComponent(SkeletonRowComponent);
    fixture.componentRef.setInput('cells', 5);
    fixture.componentRef.setInput('seed', 0);
    fixture.detectChanges();
    const firstRow = fixture.componentInstance.widths();

    fixture.componentRef.setInput('seed', 1);
    fixture.detectChanges();

    expect(fixture.componentInstance.widths()).not.toEqual(firstRow);
  });

  it('renders <td> cells in the table variant', () => {
    const fixture = TestBed.createComponent(SkeletonCellsComponent);
    fixture.componentRef.setInput('cells', 8);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('td')).toHaveLength(8);
  });
});

describe('RowLockComponent', () => {
  beforeEach(setup);

  it('carries the reason in the tooltip — two causes, same padlock', () => {
    const fixture = TestBed.createComponent(RowLockComponent);
    fixture.componentRef.setInput('reason', 'Votre rôle ne permet pas de supprimer une vente.');
    fixture.detectChanges();

    const lock = fixture.nativeElement.querySelector('.rl');

    expect(lock.getAttribute('title')).toBe('Votre rôle ne permet pas de supprimer une vente.');
    expect(lock.getAttribute('aria-label')).toBe('Votre rôle ne permet pas de supprimer une vente.');
  });
});

describe('describeLoadError', () => {
  it('names the network case, which is the common one', () => {
    const { cause } = describeLoadError(new HttpErrorResponse({ status: 0 }));

    expect(cause).toBe("Le serveur n'a pas répondu.");
  });

  it('distinguishes a refused role from a broken server', () => {
    expect(describeLoadError(new HttpErrorResponse({ status: 403 })).cause).toContain('rôle');
    expect(describeLoadError(new HttpErrorResponse({ status: 500 })).cause).toContain('serveur a rencontré');
  });

  it('puts the server message in the detail, not in the sentence shown', () => {
    const { cause, detail } = describeLoadError(
      new HttpErrorResponse({ status: 422, error: { message: 'date_from invalide' } }),
    );

    expect(cause).not.toContain('date_from');
    expect(detail).toContain('date_from invalide');
    expect(detail).toContain('HTTP 422');
  });

  it('survives something that is not an HTTP error at all', () => {
    const { cause, detail } = describeLoadError(new Error('boom'));

    expect(cause).toBe('La requête a échoué.');
    expect(detail).toBe('Erreur inattendue');
  });
});

describe('frenchDate', () => {
  it('turns an <input type="date"> value into a readable one', () => {
    expect(frenchDate('2026-09-01')).toBe('01/09/2026');
  });

  it('leaves anything else alone', () => {
    expect(frenchDate('septembre')).toBe('septembre');
    expect(frenchDate('')).toBe('');
  });
});
