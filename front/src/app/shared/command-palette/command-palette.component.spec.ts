import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { EMPTY, of, throwError } from 'rxjs';

import { CommandPaletteComponent } from './command-palette.component';
import { CommandPaletteService } from './command-palette.service';
import { looseIncludes } from './command-palette.model';
import { AuthService } from '../../core/services/auth.service';
import { ClientService } from '../../features/clients/data-access/client.service';
import { SaleService } from '../../features/sales/data-access/sale.service';
import { ServiceOrderService } from '../../features/service-orders/data-access/service-order.service';
import { StockService } from '../../features/stock/data-access/stock.service';

/** Refonte 2b — palette de commandes (⌘K). */

// L'application tourne sans zone.js : `fakeAsync`/`tick` ne sont pas
// disponibles. Les minuteurs de Vitest font le même travail pour franchir
// l'anti-rebond de 250 ms.
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const CLIENT = { id: 7, name: 'DELTA MOTORS', city: 'Kénitra', phone: '0600' };
const SALE = { id: 1108, date: '2026-09-16', total_sale: 1700, linked_client: { name: 'DELTA MOTORS' } };
const ORDER = { id: 2, date: '2026-08-10', vehicle: '', status: 'TERMINE', client_record: { id: 1, name: 'EL MEHDI' } };
const STOCK = { product_id: 3, dimension: '205/55R16', brand: 'MICHELIN', profile: 'PRIMACY 5', reference: 'M20-P5', quantity: 14 };

function page<T>(data: T[]) {
  return { data, current_page: 1, last_page: 1, total: data.length };
}

interface Stubs {
  permissions?: string[];
  clients?: () => unknown;
  sales?: () => unknown;
  sale?: () => unknown;
  orders?: () => unknown;
  stock?: () => unknown;
}

function build(stubs: Stubs = {}) {
  const granted = stubs.permissions ?? ['view clients', 'view sales', 'view service-orders', 'view stock'];

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      provideRouter([]),
      { provide: AuthService, useValue: { hasPermission: (p: string) => granted.includes(p) } },
      { provide: ClientService, useValue: { getClients: stubs.clients ?? (() => of([CLIENT])) } },
      {
        provide: SaleService,
        useValue: {
          getSales: stubs.sales ?? (() => of(page([SALE]))),
          getSale: stubs.sale ?? (() => EMPTY),
        },
      },
      { provide: ServiceOrderService, useValue: { getServiceOrders: stubs.orders ?? (() => of(page([ORDER]))) } },
      { provide: StockService, useValue: { getGrouped: stubs.stock ?? (() => of(page([STOCK]))) } },
    ],
  });

  const fixture = TestBed.createComponent(CommandPaletteComponent);
  const palette = TestBed.inject(CommandPaletteService);
  palette.open();
  fixture.detectChanges();

  return { fixture, component: fixture.componentInstance, palette };
}

/** Saisit un terme et laisse passer l'anti-rebond. */
function type(component: CommandPaletteComponent, term: string): void {
  component.onInput(term);
  vi.advanceTimersByTime(300);
}

function titles(component: CommandPaletteComponent): string[] {
  return component.groups().map((group) => group.title);
}

describe('CommandPaletteComponent', () => {
  describe('à l\'ouverture', () => {
    it('ne propose que des destinations, sans interroger le serveur', (() => {
      const clients = vi.fn().mockReturnValue(of([CLIENT]));
      const { component } = build({ clients });
      vi.advanceTimersByTime(300);

      expect(titles(component)).toEqual(['Aller à']);
      expect(clients).not.toHaveBeenCalled();
      expect(component.flatResults().length).toBeGreaterThan(0);
    }));

    it('cache les destinations que le rôle ne peut pas atteindre', (() => {
      const { component } = build({ permissions: [] });
      vi.advanceTimersByTime(300);

      const labels = component.flatResults().map((r) => r.label);

      expect(labels).toContain('Accueil');
      expect(labels).not.toContain('Ventes');
      expect(labels).not.toContain('Utilisateurs');
    }));
  });

  describe('recherche', () => {
    it('n\'interroge pas le serveur sous deux caractères', (() => {
      const clients = vi.fn().mockReturnValue(of([CLIENT]));
      const { component } = build({ clients });
      type(component, 'd');

      expect(clients).not.toHaveBeenCalled();
    }));

    it('regroupe les résultats par source', (() => {
      const { component } = build();
      type(component, 'delta');

      expect(titles(component)).toEqual(['Clients', 'Ventes', 'Service Auto', 'Stock']);
    }));

    it('n\'interroge que les sources autorisées', (() => {
      const sales = vi.fn().mockReturnValue(of(page([SALE])));
      const stock = vi.fn().mockReturnValue(of(page([STOCK])));
      const { component } = build({ permissions: ['view sales'], sales, stock });
      type(component, 'delta');

      expect(sales).toHaveBeenCalled();
      expect(stock).not.toHaveBeenCalled();
      expect(titles(component)).toEqual(['Ventes']);
    }));

    it('cherche aussi la vente par son numéro quand la saisie est numérique', (() => {
      const sale = vi.fn().mockReturnValue(of(SALE));
      const { component } = build({ permissions: ['view sales'], sale, sales: () => of(page([])) });
      type(component, '1108');

      expect(sale).toHaveBeenCalledWith(1108);
      expect(component.flatResults()[0].label).toBe('Vente 1108');
    }));

    it('ne cherche pas de numéro quand la saisie ne l\'est pas', (() => {
      const sale = vi.fn().mockReturnValue(of(SALE));
      const { component } = build({ permissions: ['view sales'], sale });
      type(component, 'delta');

      expect(sale).not.toHaveBeenCalled();
    }));

    it('ne compte pas pour une panne un numéro de vente inexistant', (() => {
      const { component } = build({
        permissions: ['view sales'],
        sale: () => throwError(() => new Error('404')),
        sales: () => of(page([SALE])),
      });
      type(component, '9999');

      expect(component.groups()[0].failed).toBe(false);
      expect(component.flatResults()).toHaveLength(1);
    }));
  });

  describe('quand une source tombe', () => {
    it('affiche les autres et signale celle qui a échoué', (() => {
      const { component } = build({ clients: () => throwError(() => new Error('down')) });
      type(component, 'delta');

      const clientsGroup = component.groups().find((g) => g.title === 'Clients');

      expect(clientsGroup?.failed).toBe(true);
      expect(titles(component)).toContain('Ventes');
      expect(titles(component)).toContain('Stock');
    }));
  });

  describe('navigation clavier', () => {
    function arrow(key: string): KeyboardEvent {
      return { key, preventDefault: () => {} } as KeyboardEvent;
    }

    it('descend et boucle en fin de liste', (() => {
      // Sans terme : la liste des destinations, assez longue pour boucler.
      const { component } = build();
      vi.advanceTimersByTime(300);
      const total = component.flatResults().length;
      expect(total).toBeGreaterThan(1);

      component.onKeydown(arrow('ArrowDown'));
      expect(component.activeIndex()).toBe(1 % total);

      component.activeIndex.set(total - 1);
      component.onKeydown(arrow('ArrowDown'));
      expect(component.activeIndex()).toBe(0);
    }));

    it('remonte depuis le premier vers le dernier', (() => {
      const { component } = build();
      vi.advanceTimersByTime(300);
      const total = component.flatResults().length;

      component.onKeydown(arrow('ArrowUp'));

      expect(component.activeIndex()).toBe(total - 1);
    }));
  });

  describe('réouverture', () => {
    /**
     * Le cas qui échouait : `distinctUntilChanged` gardait le dernier terme, si
     * bien que retaper exactement la même chose après fermeture ne relançait
     * aucune recherche — le champ affichait le terme, la liste montrait les
     * destinations.
     */
    it('retrouve les mêmes résultats quand on retape le même terme', (() => {
      const { component, palette, fixture } = build();

      type(component, 'delta');
      expect(titles(component)).toContain('Clients');

      palette.close();
      palette.open();
      // La remise à zéro vit dans un `effect()` : sans détection de changement,
      // elle ne s'exécute pas en test zoneless.
      fixture.detectChanges();
      vi.advanceTimersByTime(300);
      expect(titles(component)).toEqual(['Aller à']);

      type(component, 'delta');
      expect(titles(component)).toContain('Clients');
    }));
  });
});

describe('looseIncludes', () => {
  it('ignore les accents et la casse', () => {
    expect(looseIncludes('Réglages', 'reglages')).toBe(true);
    expect(looseIncludes('Kénitra', 'KENITRA')).toBe(true);
  });

  it('ne rapproche pas ce qui diffère vraiment', () => {
    expect(looseIncludes('Ventes', 'achats')).toBe(false);
  });
});
