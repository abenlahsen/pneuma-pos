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

  describe('openPrint', () => {
    it('sets printDoc signal (not null)', () => {
      comp.purchase = { id: 10, date: '2026-05-01', items: [], total_price: 0 } as any;
      comp.openPrint();
      expect(comp.printDoc()).not.toBeNull();
    });

    it('sets type=purchase and party_label=Fournisseur', () => {
      comp.purchase = { id: 10, date: '2026-05-01', items: [], total_price: 0 } as any;
      comp.openPrint();
      const doc = comp.printDoc()!;
      expect(doc.type).toBe('purchase');
      expect(doc.party_label).toBe('Fournisseur');
    });

    it('sets doc_number from purchase.id', () => {
      comp.purchase = { id: 42, date: '2026-05-01', items: [], total_price: 0 } as any;
      comp.openPrint();
      expect(comp.printDoc()!.doc_number).toBe('42');
    });

    it('uses supplier.name as party_name', () => {
      comp.purchase = { id: 1, date: '2026-05-01', items: [], total_price: 0, supplier: { name: 'Fournisseur SA' } } as any;
      comp.openPrint();
      expect(comp.printDoc()!.party_name).toBe('Fournisseur SA');
    });

    it('falls back to "-" when supplier is absent', () => {
      comp.purchase = { id: 1, date: '2026-05-01', items: [], total_price: 0, supplier: null } as any;
      comp.openPrint();
      expect(comp.printDoc()!.party_name).toBe('-');
    });

    it('maps line label from linkedProduct.reference and sets discount=0, total=price×qty', () => {
      comp.purchase = {
        id: 1, date: '2026-05-01', total_price: 200,
        items: [{ linkedProduct: { reference: 'REF-001' }, product_id: 5, quantity: 2, unit_price: 100 }],
      } as any;
      comp.openPrint();
      const line = comp.printDoc()!.lines[0];
      expect(line.label).toBe('REF-001');
      expect(line.discount).toBe(0);
      expect(line.total).toBe(200);
    });

    it('falls back to "Produit #id" when linkedProduct has no reference', () => {
      comp.purchase = {
        id: 1, date: '2026-05-01', total_price: 50,
        items: [{ product_id: 7, quantity: 1, unit_price: 50 }],
      } as any;
      comp.openPrint();
      expect(comp.printDoc()!.lines[0].label).toBe('Produit #7');
    });
  });
});
