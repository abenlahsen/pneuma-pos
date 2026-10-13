import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';

import { SpinnerComponent } from './spinner.component';

/** Refonte 2b, étape 14a — l'anneau partagé de la maquette 21a. */
describe('SpinnerComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  });

  function render(inputs: Record<string, unknown> = {}): HTMLElement {
    const fixture = TestBed.createComponent(SpinnerComponent);
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('s’annonce comme un état, avec un libellé', () => {
    const ring = render();

    expect(ring.getAttribute('role')).toBe('status');
    expect(ring.getAttribute('aria-label')).toBe('Chargement en cours');
  });

  it('prend le libellé de ce qui attend', () => {
    const ring = render({ label: 'Enregistrement du paiement' });

    expect(ring.getAttribute('aria-label')).toBe('Enregistrement du paiement');
  });

  it('se tait quand le texte voisin dit déjà ce qui se passe', () => {
    const ring = render({ decorative: true });

    expect(ring.getAttribute('role')).toBeNull();
    expect(ring.getAttribute('aria-label')).toBeNull();
    expect(ring.getAttribute('aria-hidden')).toBe('true');
  });

  it('a une variante de 12 px, pour la barre de filtres', () => {
    expect(render({ size: 12 }).classList).toContain('sp-sm');
    expect(render().classList).not.toContain('sp-sm');
  });
});
