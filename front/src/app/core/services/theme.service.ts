import { DOCUMENT } from '@angular/common';
import { Inject, Injectable } from '@angular/core';
import {
  CompanySettings,
  DEFAULT_CONTENT_WIDTH,
} from '../../features/settings/models/company-settings.model';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  constructor(@Inject(DOCUMENT) private document: Document) {}

  /**
   * Seule la largeur du contenu reste réglable : c'est le seul attribut
   * qu'une règle CSS lise encore (app.scss, `data-content-width`).
   *
   * Les trois couleurs et le mode clair/sombre sont retirés. Les couleurs ne
   * pilotaient plus rien depuis le passage aux jetons SCSS de la refonte 2b ;
   * le mode sombre, lui, s'appliquait encore à moitié sur un poste réglé en
   * sombre — fond bleu nuit, titres illisibles, cartes restées blanches.
   */
  applyCompanyTheme(settings: Partial<CompanySettings> | null | undefined): void {
    const contentWidth = settings?.content_width ?? DEFAULT_CONTENT_WIDTH;

    this.document.documentElement.setAttribute('data-content-width', contentWidth);
  }
}
