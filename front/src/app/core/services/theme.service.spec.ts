import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';

import { ThemeService } from './theme.service';

/**
 * Il ne reste au thème qu'un réglage lu par une règle CSS : la largeur du
 * contenu (app.scss, `data-content-width`). Les couleurs et le mode sombre
 * sont retirés — l'application est claire, comme la refonte 2b la dessine.
 */
describe('ThemeService', () => {
  let theme: ThemeService;
  const root = document.documentElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    theme = TestBed.inject(ThemeService);
  });

  afterEach(() => root.removeAttribute('data-content-width'));

  it('pose la largeur de contenu réglée sur <html>', () => {
    theme.applyCompanyTheme({ content_width: 'boxed' });

    expect(root.getAttribute('data-content-width')).toBe('boxed');
  });

  it('revient à la pleine largeur sans réglage, par exemple à la déconnexion', () => {
    theme.applyCompanyTheme({ content_width: 'compact' });
    theme.applyCompanyTheme(null);

    expect(root.getAttribute('data-content-width')).toBe('full');
  });
});
