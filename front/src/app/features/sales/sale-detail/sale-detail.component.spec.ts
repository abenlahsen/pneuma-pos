import { SaleDetailComponent } from './sale-detail.component';
import { Product } from '../../../core/models/product.model';

describe('SaleDetailComponent', () => {
  let comp: SaleDetailComponent;
  const mockAuthService = { hasPermission: () => true };
  const mockShipmentChangeService = { getForSale: () => ({ subscribe: () => {} }) };

  beforeEach(() => {
    comp = new SaleDetailComponent(mockAuthService as any, mockShipmentChangeService as any);
    comp.sale = { items: [] } as any;
  });

  describe('lineTotal', () => {
    it('returns item.total directly when present', () => {
      expect(comp.lineTotal({ total: 150, selling_price: 999, quantity: 1, discount: 0 })).toBe(150);
    });

    it('computes price × qty × (1 - discount/100) when total is null', () => {
      expect(comp.lineTotal({ total: null, selling_price: 100, quantity: 3, discount: 10 })).toBe(270);
      expect(comp.lineTotal({ total: null, selling_price: 50, quantity: 2, discount: 0 })).toBe(100);
    });

    it('clamps discount: negative treated as 0, above 100 treated as 100', () => {
      expect(comp.lineTotal({ total: null, selling_price: 100, quantity: 1, discount: -50 })).toBe(100);
      expect(comp.lineTotal({ total: null, selling_price: 100, quantity: 1, discount: 150 })).toBe(0);
    });
  });

  describe('clientName getter', () => {
    it('prefers linked_client.name when present', () => {
      comp.sale = { linked_client: { name: 'Alice' }, client: 'Bob' } as any;
      expect(comp.clientName).toBe('Alice');
    });

    it('falls back to sale.client (trimmed) when linked_client is absent', () => {
      comp.sale = { linked_client: null, client: ' Bob ' } as any;
      expect(comp.clientName).toBe('Bob');
    });

    it('returns dash when both are absent or empty', () => {
      comp.sale = { linked_client: null, client: '' } as any;
      expect(comp.clientName).toBe('-');
    });
  });

  describe('getProduct', () => {
    it('resolves priority: linkedProduct > linked_product > product', () => {
      const p1 = { id: 1 } as Product, p2 = { id: 2 } as Product, p3 = { id: 3 } as Product;
      expect(comp.getProduct({ linkedProduct: p1, linked_product: p2, product: p3 })).toBe(p1);
      expect(comp.getProduct({ linked_product: p2, product: p3 })).toBe(p2);
      expect(comp.getProduct({ product: p3 })).toBe(p3);
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
      comp.openProductView({ linkedProduct: { id: 7 } });
      expect(open).toHaveBeenCalledWith('/products/7/edit', '_blank', 'noopener');
    });

    // Côté vente, getProduct accepte aussi item.product en dernier recours —
    // contrairement à l'achat. Une ligne sans produit du tout, donc.
    it("n'ouvre rien quand la ligne ne porte aucun produit résolu", () => {
      comp.openProductView({ product_id: 9, product_name: 'Hors catalogue' });
      expect(open).not.toHaveBeenCalled();
    });
  });

  // La mise en forme du document est testée dans features/documents/print-builders.spec.ts.
  describe('openPrint', () => {
    it('navigue vers la page d’impression de la vente', () => {
      const navigate = vi.fn();
      comp = new SaleDetailComponent(mockAuthService as any, mockShipmentChangeService as any, { navigate } as any);
      comp.sale = { id: 99, items: [] } as any;

      comp.openPrint();

      expect(navigate).toHaveBeenCalledWith(['/documents', 'sale', 99, 'print']);
    });

    it('ne navigue pas sans vente chargée', () => {
      const navigate = vi.fn();
      comp = new SaleDetailComponent(mockAuthService as any, mockShipmentChangeService as any, { navigate } as any);
      comp.sale = { items: [] } as any;

      comp.openPrint();

      expect(navigate).not.toHaveBeenCalled();
    });
  });

  describe('prev / next navigation', () => {
    function keydown(key: string, target?: EventTarget): KeyboardEvent {
      const event = new KeyboardEvent('keydown', { key, cancelable: true });
      if (target) Object.defineProperty(event, 'target', { value: target });
      return event;
    }

    it('ngOnChanges with a new sale resets local state and reloads shipment requests for the new id', () => {
      const getForSale = vi.fn(() => ({ subscribe: () => {} }));
      comp = new SaleDetailComponent(mockAuthService as any, { getForSale } as any);
      comp.sale = { id: 7, items: [] } as any;
      comp.showShipmentForm.set(true);

      comp.ngOnChanges({ sale: { previousValue: { id: 7 }, currentValue: comp.sale, firstChange: false, isFirstChange: () => false } });

      expect(getForSale).toHaveBeenCalledWith(7);
      expect(comp.showShipmentForm()).toBe(false);
    });

    it('ngOnChanges ignores the first change (ngOnInit handles the initial load)', () => {
      const getForSale = vi.fn(() => ({ subscribe: () => {} }));
      comp = new SaleDetailComponent(mockAuthService as any, { getForSale } as any);
      comp.sale = { id: 7, items: [] } as any;

      comp.ngOnChanges({ sale: { previousValue: undefined, currentValue: comp.sale, firstChange: true, isFirstChange: () => true } });

      expect(getForSale).not.toHaveBeenCalled();
    });

    it('arrow keys emit prev/next only when navigation is possible', () => {
      const prev = vi.fn(); const next = vi.fn();
      comp.prev.subscribe(prev); comp.next.subscribe(next);

      comp.onKeydown(keydown('ArrowRight'));
      expect(next).not.toHaveBeenCalled();

      comp.hasNext = true; comp.hasPrev = true;
      comp.onKeydown(keydown('ArrowRight'));
      comp.onKeydown(keydown('ArrowLeft'));
      expect(next).toHaveBeenCalledTimes(1);
      expect(prev).toHaveBeenCalledTimes(1);
    });

    it('arrow keys are ignored while typing in a field or when a nested panel is open', () => {
      const next = vi.fn();
      comp.next.subscribe(next);
      comp.hasNext = true;

      comp.onKeydown(keydown('ArrowRight', document.createElement('input')));
      expect(next).not.toHaveBeenCalled();

      comp.showShipmentForm.set(true);
      comp.onKeydown(keydown('ArrowRight'));
      expect(next).not.toHaveBeenCalled();
    });
  });
});
