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

  describe('toggleMovements', () => {
    it('fetches movements and sets showMovements true on first toggle', () => {
      mockMovementService.getMovements.mockReturnValue(of({ data: [{ id: 10 }] }));
      comp.toggleMovements();
      expect(comp.showMovements()).toBe(true);
      expect(mockMovementService.getMovements).toHaveBeenCalledWith({ product_id: 1, per_page: 100 });
    });

    it('does NOT re-fetch when movements already loaded on second show', () => {
      comp.movements.set([{ id: 1 } as any]);
      comp.toggleMovements(); // show (movements exist → no fetch)
      comp.toggleMovements(); // hide
      comp.toggleMovements(); // show again (movements still exist → no fetch)
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
});
