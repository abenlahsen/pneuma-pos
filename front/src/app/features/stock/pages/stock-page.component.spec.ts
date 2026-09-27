import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { Subject } from 'rxjs';

import { StockPageComponent } from './stock-page.component';
import { StockService } from '../data-access/stock.service';
import { AuthService } from '../../../core/services/auth.service';
import { StockGroup, StockSummary } from '../models/stock.model';

/**
 * Une réponse périmée ne doit jamais écraser la plus récente : une recherche
 * lancée avant la fin du chargement initial affichait tout le stock, parce
 * que la réponse initiale, plus lente, arrivait après la réponse filtrée.
 */
type GroupedPage = { data: StockGroup[]; current_page: number; last_page: number; total: number };

function page(ids: number[]): GroupedPage {
  return { data: ids.map(id => ({ product_id: id } as StockGroup)), current_page: 1, last_page: 1, total: ids.length };
}

describe('StockPageComponent — chargements concurrents', () => {
  let comp: StockPageComponent;
  let grouped: Subject<GroupedPage>[];
  let summaries: Subject<StockSummary>[];

  beforeEach(() => {
    grouped = [];
    summaries = [];
    const stockService = {
      getGrouped: vi.fn(() => { const s = new Subject<GroupedPage>(); grouped.push(s); return s; }),
      getSummary: vi.fn(() => { const s = new Subject<StockSummary>(); summaries.push(s); return s; }),
      getFilters: vi.fn(() => new Subject()),
    };

    TestBed.configureTestingModule({
      imports: [StockPageComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: StockService, useValue: stockService },
        { provide: AuthService, useValue: { hasPermission: () => true } },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({}) } } },
      ],
    });
    comp = TestBed.createComponent(StockPageComponent).componentInstance;
  });

  it('abandonne la liste en vol quand un nouveau chargement part', () => {
    comp.loadData();              // chargement initial, encore en vol
    comp.searchQuery.set('MICHELIN');
    comp.loadData();              // la recherche

    expect(grouped[0].observed).toBe(false);
    expect(grouped[1].observed).toBe(true);

    grouped[1].next(page([2]));   // la réponse filtrée arrive d'abord…
    grouped[0].next(page([1, 2, 3])); // …la réponse initiale, plus lente, ensuite

    expect(comp.groups().map(g => g.product_id)).toEqual([2]);
    expect(comp.total()).toBe(1);
    expect(comp.loading()).toBe(false);
  });

  it('abandonne aussi le résumé en vol : les cadrans suivent la même recherche', () => {
    comp.loadData();
    comp.loadData();

    expect(summaries[0].observed).toBe(false);
    summaries[1].next({ total_quantity: 20 } as StockSummary);
    summaries[0].next({ total_quantity: 999 } as StockSummary);

    expect(comp.summary().total_quantity).toBe(20);
  });
});
