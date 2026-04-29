import { PurchaseDetailComponent } from './purchase-detail.component';
import { Product } from '../../../core/models/product.model';

describe('PurchaseDetailComponent', () => {
  let comp: PurchaseDetailComponent;

  beforeEach(() => {
    comp = new PurchaseDetailComponent();
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
    it('sets viewingProduct when product resolves via linkedProduct', () => {
      const fakeProduct = { id: 5 } as Product;
      comp.openProductView({ linkedProduct: fakeProduct });
      expect(comp.viewingProduct()).toEqual(fakeProduct);
    });

    it('does NOT set viewingProduct when only .product is present', () => {
      comp.openProductView({ product: { id: 5 } });
      expect(comp.viewingProduct()).toBeNull();
    });
  });

  describe('editProductInNewTab', () => {
    let openSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => { openSpy = vi.spyOn(window, 'open').mockReturnValue(null as any); });
    afterEach(() => vi.restoreAllMocks());

    it('clears viewingProduct and opens /products?id=5&edit=1 in a new tab', () => {
      const fakeProduct = { id: 5 } as Product;
      comp.viewingProduct.set(fakeProduct);
      comp.editProductInNewTab(fakeProduct);
      expect(comp.viewingProduct()).toBeNull();
      expect(openSpy).toHaveBeenCalledWith('/products?id=5&edit=1', '_blank', 'noopener');
    });
  });
});
