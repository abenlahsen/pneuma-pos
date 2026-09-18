import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { EMPTY, of, throwError } from 'rxjs';

import { SalesPageComponent } from './sales-page.component';
import { SaleService } from '../data-access/sale.service';
import { AuthService } from '../../../core/services/auth.service';
import { CityService } from '../../../core/services/city.service';
import { Sale } from '../models/sale.model';

describe('SalesPageComponent', () => {
  let comp: SalesPageComponent;

  beforeEach(() => {
    // Bypasses the constructor (several injected services + inject()-based
    // fields) since statusOptionsFor() is a pure method that only reads its
    // argument and the imported SALE_STATUS_TRANSITIONS constant.
    comp = Object.create(SalesPageComponent.prototype);
  });

  describe('statusOptionsFor', () => {
    it('lists EN COURS transitions: current status first, then LIVRE/MONTE/ANNULE', () => {
      const options = comp.statusOptionsFor({ status: 'EN COURS' } as Sale);
      expect(options).toEqual(['EN COURS', 'LIVRE', 'MONTE', 'ANNULE']);
    });

    it('never offers a direct jump from EN COURS to TERMINEE', () => {
      const options = comp.statusOptionsFor({ status: 'EN COURS' } as Sale);
      expect(options).not.toContain('TERMINEE');
    });

    it('lists LIVRE transitions: current status first, then EN COURS/MONTE/TERMINEE', () => {
      const options = comp.statusOptionsFor({ status: 'LIVRE' } as Sale);
      expect(options).toEqual(['LIVRE', 'EN COURS', 'MONTE', 'TERMINEE']);
    });

    it('allows the lateral move from LIVRE to MONTE', () => {
      const options = comp.statusOptionsFor({ status: 'LIVRE' } as Sale);
      expect(options).toContain('MONTE');
    });

    it('restricts TERMINEE to going back to LIVRE or MONTE only', () => {
      const options = comp.statusOptionsFor({ status: 'TERMINEE' } as Sale);
      expect(options).toEqual(['TERMINEE', 'LIVRE', 'MONTE']);
    });

    it('treats ANNULE as a dead end: only EN COURS is offered', () => {
      const options = comp.statusOptionsFor({ status: 'ANNULE' } as Sale);
      expect(options).toEqual(['ANNULE', 'EN COURS']);
      expect(options).not.toContain('TERMINEE');
    });
  });

  /**
   * Refonte 2b : les cadrans lisent un signal initialisé à zéro. Sans drapeau,
   * un résumé qui échoue laisse « CA du jour : 0,00 DH » à l'écran — un chiffre
   * affirmé que personne n'a calculé.
   */
  describe('summaryLoaded', () => {
    const emptyPage = { data: [], current_page: 1, last_page: 1, total: 0 };
    const summary = { tyres_today: 7, sales_en_cours: 2 };

    function build(getSummary: () => unknown) {
      const saleService = {
        getSales: () => of(emptyPage),
        getSummary,
        getFilters: () => EMPTY,
      };

      TestBed.configureTestingModule({
        providers: [
          provideZonelessChangeDetection(),
          { provide: SaleService, useValue: saleService },
          { provide: AuthService, useValue: { hasPermission: () => true, hasRole: () => true } },
          { provide: CityService, useValue: { getCities: () => EMPTY } },
          { provide: ActivatedRoute, useValue: { queryParamMap: EMPTY } },
        ],
      });

      return TestBed.createComponent(SalesPageComponent).componentInstance;
    }

    it('starts unloaded, so the cards never assert a zero they were not given', () => {
      expect(build(() => EMPTY).summaryLoaded()).toBe(false);
    });

    it('marks the summary loaded once it arrives', () => {
      const component = build(() => of(summary));
      component.loadData();

      expect(component.summaryLoaded()).toBe(true);
      expect(component.summary().tyres_today).toBe(7);
    });

    it('stays unloaded when the summary request fails', () => {
      const component = build(() => throwError(() => new Error('down')));
      component.loadData();

      expect(component.summaryLoaded()).toBe(false);
    });

    it('does not let a failed summary hide the list, which loaded fine', () => {
      const component = build(() => throwError(() => new Error('down')));
      component.loadData();

      expect(component.loadError()).toBeNull();
    });
  });

  /**
   * Refonte 2b, §14c état 4. Le grief du handoff n'est pas que les boutons
   * soient masqués — c'est que la colonne Actions change alors de largeur d'une
   * ligne à l'autre, sans jamais dire pourquoi. Le cadenas occupe la place du
   * bouton absent et porte la raison dans son infobulle.
   */
  describe('colonne Actions verrouillée', () => {
    const sale = {
      id: 1,
      date: '2026-09-18',
      status: 'EN COURS',
      payment_status: 'PAYE',
      total_sale: 1000,
      total_quantity: 2,
      margin: 100,
    } as Sale;

    function render(canDo: boolean) {
      // Le test de largeur constante rend les deux variantes coup sur coup ;
      // TestBed n'accepte qu'une configuration par module instancié.
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          provideZonelessChangeDetection(),
          provideRouter([]),
          {
            provide: SaleService,
            useValue: {
              getSales: () => of({ data: [sale], current_page: 1, last_page: 1, total: 1 }),
              getSummary: () => EMPTY,
              getFilters: () => EMPTY,
            },
          },
          { provide: AuthService, useValue: { hasPermission: () => canDo, hasRole: () => true } },
          { provide: CityService, useValue: { getCities: () => EMPTY } },
        ],
      });

      const fixture = TestBed.createComponent(SalesPageComponent);
      fixture.detectChanges();
      return fixture.nativeElement.querySelector('.actions-cell') as HTMLElement;
    }

    it('shows a padlock in place of each action the role cannot perform', () => {
      const cell = render(false);

      expect(cell.querySelectorAll('app-row-lock')).toHaveLength(2);
      expect(cell.querySelector('a[title="Modifier"]')).toBeNull();
    });

    it('says which action is refused, so the two causes stay distinguishable', () => {
      const reasons = [...render(false).querySelectorAll('app-row-lock .rl')].map((el) =>
        el.getAttribute('title'),
      );

      expect(reasons[0]).toContain('modifier');
      expect(reasons[1]).toContain('supprimer');
    });

    it('keeps the same number of controls either way, so the column keeps its width', () => {
      const allowed = render(true).children.length;
      const refused = render(false).children.length;

      expect(refused).toBe(allowed);
    });

    it('shows the real buttons and no padlock when the role is allowed', () => {
      const cell = render(true);

      expect(cell.querySelectorAll('app-row-lock')).toHaveLength(0);
      expect(cell.querySelector('a[title="Modifier"]')).not.toBeNull();
    });
  });
});
