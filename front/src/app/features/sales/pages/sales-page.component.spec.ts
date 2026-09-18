import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
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
});
