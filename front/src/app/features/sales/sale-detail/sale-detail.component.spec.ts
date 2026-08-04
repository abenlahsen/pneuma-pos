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

  describe('openPrint', () => {
    it('sets printDoc signal (not null)', () => {
      comp.sale = { id: 5, date: '2026-05-01', items: [], total_sale: 0 } as any;
      comp.openPrint();
      expect(comp.printDoc()).not.toBeNull();
    });

    it('sets type=sale and party_label=Client', () => {
      comp.sale = { id: 5, date: '2026-05-01', items: [], total_sale: 0 } as any;
      comp.openPrint();
      const doc = comp.printDoc()!;
      expect(doc.type).toBe('sale');
      expect(doc.party_label).toBe('Client');
    });

    it('sets doc_number from sale.id', () => {
      comp.sale = { id: 99, date: '2026-05-01', items: [], total_sale: 0 } as any;
      comp.openPrint();
      expect(comp.printDoc()!.doc_number).toBe('99');
    });

    it('uses linkedProduct.reference as line label (highest priority)', () => {
      comp.sale = {
        id: 1, date: '2026-05-01', total_sale: 300,
        items: [{ linkedProduct: { reference: 'REF-100' }, product_name: 'Pneu', quantity: 3, selling_price: 100, discount: 0, total: 300 }],
      } as any;
      comp.openPrint();
      expect(comp.printDoc()!.lines[0].label).toBe('REF-100');
    });

    it('falls back to product_name when linkedProduct has no reference', () => {
      comp.sale = {
        id: 1, date: '2026-05-01', total_sale: 100,
        items: [{ product_name: 'Pneu 205/55R16', product_id: 3, quantity: 1, selling_price: 100, discount: 0, total: 100 }],
      } as any;
      comp.openPrint();
      expect(comp.printDoc()!.lines[0].label).toBe('Pneu 205/55R16');
    });

    it('falls back to "Produit #id" when neither reference nor product_name', () => {
      comp.sale = {
        id: 1, date: '2026-05-01', total_sale: 50,
        items: [{ product_id: 9, quantity: 1, selling_price: 50, discount: 0, total: 50 }],
      } as any;
      comp.openPrint();
      expect(comp.printDoc()!.lines[0].label).toBe('Produit #9');
    });

    it('maps line discount from item.discount', () => {
      comp.sale = {
        id: 1, date: '2026-05-01', total_sale: 180,
        items: [{ product_name: 'X', quantity: 2, selling_price: 100, discount: 10, total: 180 }],
      } as any;
      comp.openPrint();
      expect(comp.printDoc()!.lines[0].discount).toBe(10);
    });

    it('includes carrier and tracking_number transport fields', () => {
      comp.sale = {
        id: 1, date: '2026-05-01', items: [], total_sale: 0,
        carrier: { name: 'Transit Express' }, tracking_number: 'TRK-999',
        partner: null, service: null, delivery_date: null, payment_methods: [],
      } as any;
      comp.openPrint();
      const doc = comp.printDoc()!;
      expect(doc.carrier).toBe('Transit Express');
      expect(doc.tracking_number).toBe('TRK-999');
    });

    it('joins payment_methods into the print document payment_method field', () => {
      comp.sale = {
        id: 1, date: '2026-05-01', items: [], total_sale: 0,
        payment_methods: ['Chèque', 'Virement'],
      } as any;
      comp.openPrint();
      expect(comp.printDoc()!.payment_method).toBe('Chèque, Virement');
    });

    it('leaves the print payment_method null when there are no recorded payments', () => {
      comp.sale = {
        id: 1, date: '2026-05-01', items: [], total_sale: 0,
        payment_methods: [],
      } as any;
      comp.openPrint();
      expect(comp.printDoc()!.payment_method).toBeNull();
    });
  });
});
