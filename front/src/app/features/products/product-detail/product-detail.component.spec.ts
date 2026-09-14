import { EMPTY, of } from 'rxjs';
import { ProductDetailComponent } from './product-detail.component';
import { StockMovementType } from '../../../core/models/stock-movement.model';

describe('ProductDetailComponent', () => {
  let comp: ProductDetailComponent;
  let mockStockService: { getStocks: ReturnType<typeof vi.fn> };
  let mockMovementService: { getMovements: ReturnType<typeof vi.fn> };
  let mockAuthService: { hasPermission: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockStockService    = { getStocks:    vi.fn().mockReturnValue(EMPTY) };
    mockMovementService = { getMovements: vi.fn().mockReturnValue(EMPTY) };
    mockAuthService     = { hasPermission: vi.fn().mockReturnValue(false) };
    comp = new ProductDetailComponent(
      mockStockService as any,
      mockMovementService as any,
      mockAuthService as any,
    );
    comp.product = { id: 1, type: 'tyre', is_active: true } as any;
  });

  describe('ngOnInit', () => {
    it('calls getStocks when product type is tyre', () => {
      comp.ngOnInit();
      expect(mockStockService.getStocks).toHaveBeenCalledWith({ product_id: '1', per_page: '200' });
    });

    it('does NOT call getStocks when product type is service', () => {
      comp.product = { id: 2, type: 'service', is_active: true } as any;
      comp.ngOnInit();
      expect(mockStockService.getStocks).not.toHaveBeenCalled();
    });
  });

  // Le repli a ete remplace par un onglet (motif « fiche », 3e) : le
  // chargement paresseux se declenche desormais a la selection de l'onglet.
  describe("selection de l onglet Mouvements", () => {
    it('charge les mouvements a la premiere selection de l onglet', () => {
      mockAuthService.hasPermission.mockReturnValue(true);
      mockMovementService.getMovements.mockReturnValue(of({ data: [{ id: 10 }] }));

      comp.selectTab('movements');

      expect(comp.activeTab()).toBe('movements');
      expect(mockMovementService.getMovements).toHaveBeenCalledWith({ product_id: 1, per_page: 100 });
    });

    it('ne recharge pas si les mouvements sont deja la', () => {
      mockAuthService.hasPermission.mockReturnValue(true);
      comp.movements.set([{ id: 1 } as any]);

      comp.selectTab('movements');
      comp.selectTab('detail');
      comp.selectTab('movements');

      expect(mockMovementService.getMovements).not.toHaveBeenCalled();
    });
  });

  describe('typeLabel', () => {
    it('returns French labels for all product types', () => {
      comp.product = { ...comp.product, type: 'tyre' };
      expect(comp.typeLabel()).toBe('Pneu');

      comp.product = { ...comp.product, type: 'part' };
      expect(comp.typeLabel()).toBe('Pièce');

      comp.product = { ...comp.product, type: 'service' };
      expect(comp.typeLabel()).toBe('Service');
    });
  });

  describe('movementTypeLabel', () => {
    it('maps all StockMovementType values to French strings', () => {
      const expected: Record<StockMovementType, string> = {
        AUTO_CREATE:   'Création produit',
        INITIAL:       'Création initiale',
        IMPORT:        'Import Excel',
        ADJUSTMENT:    'Ajustement',
        DELETION:      'Suppression',
        SALE_OUT:      'Vente',
        SALE_IN:       'Annulation vente',
        PURCHASE_IN:   'Achat',
        PURCHASE_OUT:  'Annulation achat',
      };
      for (const [type, label] of Object.entries(expected) as [StockMovementType, string][]) {
        expect(comp.movementTypeLabel(type)).toBe(label);
      }
    });
  });

  describe('seasonLabel', () => {
    it('maps tire season keys to French labels', () => {
      comp.product = { id: 1, type: 'tyre', tyre: { tire_season: 'summer' } } as any;
      expect(comp.seasonLabel()).toBe('Été');

      comp.product = { id: 1, type: 'tyre', tyre: { tire_season: 'winter' } } as any;
      expect(comp.seasonLabel()).toBe('Hiver');

      comp.product = { id: 1, type: 'tyre', tyre: { tire_season: 'all_season' } } as any;
      expect(comp.seasonLabel()).toBe('4 Saisons');

      comp.product = { id: 1, type: 'tyre', tyre: {} } as any;
      expect(comp.seasonLabel()).toBe('-');
    });
  });

  describe('onglets de la fiche (motif « fiche », 3e)', () => {
    it('offre Détail, Stock et Mouvements pour un pneu quand la permission est accordée', () => {
      mockAuthService.hasPermission.mockReturnValue(true);
      comp.product = { id: 1, type: 'tyre', is_active: true } as any;

      expect(comp.tabs().map((t) => t.id)).toEqual(['detail', 'stock', 'movements']);
    });

    it("n'offre que Détail pour un service : il n'a ni stock ni mouvement", () => {
      mockAuthService.hasPermission.mockReturnValue(true);
      comp.product = { id: 2, type: 'service', is_active: true } as any;

      expect(comp.tabs().map((t) => t.id)).toEqual(['detail']);
    });

    it('masque Mouvements sans la permission view stock-movements', () => {
      mockAuthService.hasPermission.mockReturnValue(false);
      comp.product = { id: 1, type: 'tyre', is_active: true } as any;

      expect(comp.tabs().map((t) => t.id)).toEqual(['detail', 'stock']);
    });

    it("retombe sur Détail si l'onglet actif disparaît avec le produit", () => {
      mockAuthService.hasPermission.mockReturnValue(true);
      comp.product = { id: 1, type: 'tyre', is_active: true } as any;
      comp.selectTab('movements');
      expect(comp.activeTab()).toBe('movements');

      comp.product = { id: 2, type: 'service', is_active: true } as any;

      expect(comp.activeTab()).toBe('detail');
    });
  });

  describe('valeur du stock', () => {
    it("somme quantite x prix d'achat sur tous les lots", () => {
      comp.stockItems.set([
        { id: 1, quantity: 4, purchase_price: 1050 },
        { id: 2, quantity: 2, purchase_price: 900 },
      ] as any);

      expect(comp.stockValue).toBe(6000);
    });

    it('vaut 0 sans aucun lot', () => {
      comp.stockItems.set([]);
      expect(comp.stockValue).toBe(0);
    });
  });
});
