import { SaleDetailComponent } from './sale-detail.component';
import { Product } from '../../../core/models/product.model';

describe('SaleDetailComponent', () => {
  let comp: SaleDetailComponent;

  beforeEach(() => {
    comp = new SaleDetailComponent();
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
    it('sets viewingProduct signal from resolved product', () => {
      const fakeProduct = { id: 7 } as Product;
      comp.openProductView({ linkedProduct: fakeProduct });
      expect(comp.viewingProduct()).toEqual(fakeProduct);
    });

    it('does NOT change viewingProduct when item has no product', () => {
      comp.openProductView({});
      expect(comp.viewingProduct()).toBeNull();
    });
  });

  describe('editProductInNewTab', () => {
    let openSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => { openSpy = vi.spyOn(window, 'open').mockReturnValue(null as any); });
    afterEach(() => vi.restoreAllMocks());

    it('clears viewingProduct and opens /products?id=7&edit=1 in a new tab', () => {
      const fakeProduct = { id: 7 } as Product;
      comp.viewingProduct.set(fakeProduct);
      comp.editProductInNewTab(fakeProduct);
      expect(comp.viewingProduct()).toBeNull();
      expect(openSpy).toHaveBeenCalledWith('/products?id=7&edit=1', '_blank', 'noopener');
    });
  });
});
