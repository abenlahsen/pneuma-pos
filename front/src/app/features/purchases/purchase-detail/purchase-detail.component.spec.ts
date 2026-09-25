import { of } from 'rxjs';
import { PurchaseDetailComponent } from './purchase-detail.component';
import { Product } from '../../../core/models/product.model';

describe('PurchaseDetailComponent', () => {
  let comp: PurchaseDetailComponent;

  beforeEach(() => {
    const mockReturnsService = { getReturns: vi.fn(() => of([])), deleteReturn: vi.fn() };
    const mockAuthService = { hasPermission: () => true };
    comp = new PurchaseDetailComponent(mockReturnsService as any, mockAuthService as any);
    comp.purchase = { items: [] } as any;
  });

  describe('getProduct', () => {
    it('returns linkedProduct when present', () => {
      const p1 = { id: 1 } as Product, p2 = { id: 2 } as Product;
      expect(comp.getProduct({ linkedProduct: p1, linked_product: p2 })).toBe(p1);
    });

    it('returns linked_product when linkedProduct is absent', () => {
      const p2 = { id: 2 } as Product;
      expect(comp.getProduct({ linked_product: p2 })).toBe(p2);
    });

    it('returns undefined when only .product is present (purchase does not check .product)', () => {
      expect(comp.getProduct({ product: { id: 3 } })).toBeUndefined();
    });
  });

  describe('openProductView', () => {
    // Refonte 2b, 6c : product-detail est supprimé ; consulter un produit,
    // c'est ouvrir son éditeur, dans un nouvel onglet pour ne pas perdre la
    // fiche en cours.
    let open: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      open = vi.fn();
      vi.stubGlobal('window', { open });
    });

    afterEach(() => vi.unstubAllGlobals());

    it("ouvre l'éditeur du produit dans un nouvel onglet", () => {
      comp.openProductView({ linkedProduct: { id: 5 } });
      expect(open).toHaveBeenCalledWith('/products/5/edit', '_blank', 'noopener');
    });

    it("n'ouvre rien quand la ligne ne porte aucun produit résolu", () => {
      comp.openProductView({ product: { id: 9 } });
      expect(open).not.toHaveBeenCalled();
    });
  });

  // La mise en forme du bon d'achat est testée dans features/documents/print-builders.spec.ts.
  describe('openPrint', () => {
    it('navigue vers la page d’impression de l’achat', () => {
      const navigate = vi.fn();
      comp = new PurchaseDetailComponent(
        { getReturns: vi.fn(() => of([])), deleteReturn: vi.fn() } as any,
        { hasPermission: () => true } as any,
        { navigate } as any,
      );
      comp.purchase = { id: 42, items: [] } as any;

      comp.openPrint();

      expect(navigate).toHaveBeenCalledWith(['/documents', 'purchase', 42, 'print']);
    });
  });

  describe('prev / next navigation', () => {
    function keydown(key: string, target?: EventTarget): KeyboardEvent {
      const event = new KeyboardEvent('keydown', { key, cancelable: true });
      if (target) Object.defineProperty(event, 'target', { value: target });
      return event;
    }

    it('ngOnChanges with a new purchase resets local state and reloads the returns for the new id', () => {
      const getReturns = vi.fn(() => of([]));
      comp = new PurchaseDetailComponent({ getReturns, deleteReturn: vi.fn() } as any, { hasPermission: () => true } as any);
      comp.purchase = { id: 12, items: [] } as any;

      comp.ngOnChanges({ purchase: { previousValue: { id: 11 }, currentValue: comp.purchase, firstChange: false, isFirstChange: () => false } });

      expect(getReturns).toHaveBeenCalledWith(12);
    });

    it('ngOnChanges ignores the first change (ngOnInit handles the initial load)', () => {
      const getReturns = vi.fn(() => of([]));
      comp = new PurchaseDetailComponent({ getReturns, deleteReturn: vi.fn() } as any, { hasPermission: () => true } as any);
      comp.purchase = { id: 12, items: [] } as any;

      comp.ngOnChanges({ purchase: { previousValue: undefined, currentValue: comp.purchase, firstChange: true, isFirstChange: () => true } });

      expect(getReturns).not.toHaveBeenCalled();
    });

    it('arrow keys emit prev/next only when navigation is possible, never while typing or printing', () => {
      const prev = vi.fn(); const next = vi.fn();
      comp.prev.subscribe(prev); comp.next.subscribe(next);

      comp.onKeydown(keydown('ArrowLeft'));
      expect(prev).not.toHaveBeenCalled();

      comp.hasPrev = true; comp.hasNext = true;
      comp.onKeydown(keydown('ArrowLeft'));
      comp.onKeydown(keydown('ArrowRight'));
      expect(prev).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledTimes(1);

      comp.onKeydown(keydown('ArrowRight', document.createElement('textarea')));
      expect(next).toHaveBeenCalledTimes(1);
    });
  });
});
