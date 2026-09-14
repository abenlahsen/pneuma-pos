import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subject, of } from 'rxjs';

import { CommandPaletteComponent } from './command-palette.component';
import { AuthService } from '../../core/services/auth.service';
import { SaleService } from '../../core/services/sale.service';
import { ProductService } from '../../core/services/product.service';

/**
 * L'espace client B2B (`2c`) porte une contrainte non negociable : aucune
 * destination interne ne doit y etre atteignable NI DEVINABLE. La palette est
 * montee une seule fois pour toute l'application — sans garde, `Ctrl K` y
 * listait Ventes, Achats, Stock et Administration.
 */
describe('CommandPaletteComponent — cloison de l’espace client', () => {
  let url = '/dashboard';
  let events: Subject<unknown>;

  function build(): CommandPaletteComponent {
    TestBed.resetTestingModule();
    events = new Subject<unknown>();

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        {
          provide: Router,
          useValue: { navigate: vi.fn(), get url() { return url; }, events },
        },
        { provide: AuthService, useValue: { hasPermission: () => true } },
        { provide: SaleService, useValue: { getSales: () => of({ data: [] }) } },
        { provide: ProductService, useValue: { getProducts: () => of({ data: [] }) } },
      ],
    });

    return TestBed.runInInjectionContext(() => new CommandPaletteComponent(
      TestBed.inject(Router),
      TestBed.inject(AuthService),
      TestBed.inject(SaleService),
      TestBed.inject(ProductService),
    ));
  }

  const labels = (comp: CommandPaletteComponent): string[] =>
    comp.results().filter((r) => r.kind === 'destination').map((r) => (r as { label: string }).label);

  it('propose les destinations internes dans l’application interne', () => {
    url = '/dashboard';
    const comp = build();

    expect(labels(comp)).toContain('Ventes');
    expect(labels(comp)).toContain('Accueil');
  });

  it('ne laisse fuir aucune destination interne depuis le portail client', () => {
    url = '/portail';
    const comp = build();
    const found = labels(comp);

    for (const interne of ['Ventes', 'Achats', 'Stock', 'Cash Flow', 'Accueil', 'Service Auto']) {
      expect(found).not.toContain(interne);
    }
  });

  it('propose a la place les quatre destinations du portail', () => {
    url = '/portail/factures';
    const comp = build();

    expect(labels(comp)).toEqual(['Mes commandes', 'Devis', 'Factures', 'Mon compte']);
  });

  // Chercher « pneu » depuis le portail ne doit pas interroger le catalogue
  // interne : le resultat lui-meme est une fuite.
  it('n’interroge ni les ventes ni les produits depuis le portail', () => {
    url = '/portail';
    const comp = build();
    comp.onQueryInput('pneu');

    expect(comp.results().every((r) => r.kind === 'destination')).toBe(true);
  });

  // La palette est montee une seule fois : elle doit suivre la navigation,
  // sinon elle garde les destinations de l'ecran ou elle a ete evaluee.
  it('recloisonne des qu’on entre dans le portail', () => {
    url = '/dashboard';
    const comp = build();
    expect(labels(comp)).toContain('Ventes');

    url = '/portail';
    events.next(new NavigationEnd(1, '/portail', '/portail'));

    expect(labels(comp)).not.toContain('Ventes');
    expect(labels(comp)).toContain('Mes commandes');
  });
});
