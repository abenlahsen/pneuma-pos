import { of } from 'rxjs';
import { PurchaseReturnComponent, returnDueEffect } from './purchase-return.component';
import { Purchase, PurchaseReturn } from '../models/purchase.model';

function makePurchaseItem(overrides: Partial<any> = {}) {
  return {
    id: 1,
    purchase_id: 10,
    product_id: 5,
    stock_id: 5,
    quantity: 10,
    unit_price: 100,
    ...overrides,
  };
}

describe('PurchaseReturnComponent', () => {
  let comp: PurchaseReturnComponent;
  let mockPurchaseService: {
    getPurchase: ReturnType<typeof vi.fn>;
    getReturns: ReturnType<typeof vi.fn>;
    createReturn: ReturnType<typeof vi.fn>;
  };
  let mockAccountService: { getAccounts: ReturnType<typeof vi.fn> };
  let mockSupplierService: { getSupplierProfile: ReturnType<typeof vi.fn> };

  function init(purchaseItems: any[], existingReturns: PurchaseReturn[] = [], payments: any[] = [], extra: Partial<Purchase> = {}) {
    mockPurchaseService.getPurchase.mockReturnValue(
      of({ id: 10, items: purchaseItems, payments, ...extra } as unknown as Purchase),
    );
    mockPurchaseService.getReturns.mockReturnValue(of(existingReturns));
    comp = new PurchaseReturnComponent(mockPurchaseService as any, mockAccountService as any, mockSupplierService as any);
    comp.purchase = { id: 10 } as Purchase;
    comp.ngOnInit();
  }

  beforeEach(() => {
    mockPurchaseService = {
      getPurchase: vi.fn(),
      getReturns: vi.fn(),
      createReturn: vi.fn(),
    };
    mockAccountService = { getAccounts: vi.fn(() => of([])) };
    mockSupplierService = { getSupplierProfile: vi.fn(() => of({ outstanding_balance: 180500 })) };
  });

  describe('ngOnInit', () => {
    it('builds one line per purchase item with remaining = quantity when nothing was returned yet', () => {
      init([makePurchaseItem({ id: 1, quantity: 10 })]);

      expect(comp.loading()).toBe(false);
      expect(comp.lines()).toHaveLength(1);
      expect(comp.lines()[0].remaining).toBe(10);
      expect(comp.lines()[0].alreadyReturned).toBe(0);
    });

    it('subtracts quantities already returned across existing returns from the remaining ceiling', () => {
      const existingReturn: PurchaseReturn = {
        id: 1, purchase_id: 10, date: '2026-04-01', total_quantity: 4, total_amount: 400, refund_amount: 0,
        items: [{ id: 1, purchase_return_id: 1, purchase_item_id: 1, product_id: 5, stock_id: 5, quantity: 4, unit_price: 100 }],
      };
      init([makePurchaseItem({ id: 1, quantity: 10 })], [existingReturn]);

      expect(comp.lines()[0].alreadyReturned).toBe(4);
      expect(comp.lines()[0].remaining).toBe(6);
    });

    it('excludes lines that have already been fully returned', () => {
      const existingReturn: PurchaseReturn = {
        id: 1, purchase_id: 10, date: '2026-04-01', total_quantity: 10, total_amount: 1000, refund_amount: 0,
        items: [{ id: 1, purchase_return_id: 1, purchase_item_id: 1, product_id: 5, stock_id: 5, quantity: 10, unit_price: 100 }],
      };
      init([makePurchaseItem({ id: 1, quantity: 10 })], [existingReturn]);

      expect(comp.lines()).toHaveLength(0);
    });

    it('computes paidAmount and alreadyRefunded from payments and returns', () => {
      const existingReturn: PurchaseReturn = {
        id: 1, purchase_id: 10, date: '2026-04-01', total_quantity: 2, total_amount: 200, refund_amount: 150,
        items: [{ id: 1, purchase_return_id: 1, purchase_item_id: 1, product_id: 5, stock_id: 5, quantity: 2, unit_price: 100 }],
      };
      init(
        [makePurchaseItem({ id: 1, quantity: 10 })],
        [existingReturn],
        [{ id: 1, amount: 1000 }, { id: 2, amount: 200 }],
      );

      expect(comp.paidAmount()).toBe(1200);
      expect(comp.alreadyRefunded()).toBe(150);
      expect(comp.availableToRefund()).toBe(1050);
    });
  });

  describe('setQuantity', () => {
    beforeEach(() => init([makePurchaseItem({ id: 1, quantity: 10 })]));

    it('clamps the quantity to the line remaining ceiling', () => {
      const line = comp.lines()[0];
      comp.setQuantity(line, 999);
      expect(comp.lines()[0].quantity).toBe(10);
    });

    it('clamps negative input to 0', () => {
      const line = comp.lines()[0];
      comp.setQuantity(line, -5);
      expect(comp.lines()[0].quantity).toBe(0);
    });

    it('floors a fractional quantity', () => {
      const line = comp.lines()[0];
      comp.setQuantity(line, 3.9);
      expect(comp.lines()[0].quantity).toBe(3);
    });
  });

  describe('totalQuantity / totalAmount', () => {
    it('sums quantity and quantity × unit_price across every line', () => {
      init([
        makePurchaseItem({ id: 1, quantity: 10, unit_price: 100 }),
        makePurchaseItem({ id: 2, quantity: 5, unit_price: 50 }),
      ]);

      comp.setQuantity(comp.lines()[0], 4);
      comp.setQuantity(comp.lines()[1], 2);

      expect(comp.totalQuantity()).toBe(6);
      expect(comp.totalAmount()).toBe(4 * 100 + 2 * 50);
    });
  });

  describe('returnAllRemaining', () => {
    it('sets every line quantity to its remaining ceiling', () => {
      init([
        makePurchaseItem({ id: 1, quantity: 10 }),
        makePurchaseItem({ id: 2, quantity: 3 }),
      ]);

      comp.returnAllRemaining();

      expect(comp.lines().map((l) => l.quantity)).toEqual([10, 3]);
      expect(comp.totalQuantity()).toBe(13);
    });
  });

  describe('toggleRefund', () => {
    it('suggests the lower of the return total and the amount available to refund', () => {
      init([makePurchaseItem({ id: 1, quantity: 10, unit_price: 100 })], [], [{ id: 1, amount: 300 }]);
      comp.setQuantity(comp.lines()[0], 10); // return total = 1000, available = 300

      comp.toggleRefund(true);

      expect(comp.refundEnabled()).toBe(true);
      expect(comp.refundAmount()).toBe(300);
    });

    it('caps the suggestion at the return total when more is available than what is being returned', () => {
      init([makePurchaseItem({ id: 1, quantity: 10, unit_price: 100 })], [], [{ id: 1, amount: 5000 }]);
      comp.setQuantity(comp.lines()[0], 2); // return total = 200, available = 5000

      comp.toggleRefund(true);

      expect(comp.refundAmount()).toBe(200);
    });

    it('does not overwrite the amount when disabling the refund', () => {
      init([makePurchaseItem({ id: 1, quantity: 10 })], [], [{ id: 1, amount: 1000 }]);
      comp.toggleRefund(true);
      comp.toggleRefund(false);

      expect(comp.refundEnabled()).toBe(false);
    });
  });

  describe('submit', () => {
    it('surfaces an error and does not call the API when nothing has a quantity set', () => {
      init([makePurchaseItem({ id: 1, quantity: 10 })]);

      comp.submit();

      expect(mockPurchaseService.createReturn).not.toHaveBeenCalled();
      expect(comp.errorMessage()).toContain('quantité');
    });

    it('posts only the lines with a positive quantity and emits saved on success', () => {
      init([
        makePurchaseItem({ id: 1, quantity: 10 }),
        makePurchaseItem({ id: 2, quantity: 5 }),
      ]);
      comp.setQuantity(comp.lines()[0], 3);
      mockPurchaseService.createReturn.mockReturnValue(of({} as PurchaseReturn));
      const savedSpy = vi.fn();
      comp.saved.subscribe(savedSpy);

      comp.submit();

      expect(mockPurchaseService.createReturn).toHaveBeenCalledWith(10, expect.objectContaining({
        items: [{ purchase_item_id: 1, quantity: 3 }],
        refund: null,
      }));
      expect(savedSpy).toHaveBeenCalled();
    });

    it('surfaces a 422 validation message from the API without closing the modal', () => {
      init([makePurchaseItem({ id: 1, quantity: 10 })]);
      comp.setQuantity(comp.lines()[0], 3);
      mockPurchaseService.createReturn.mockReturnValue(
        of(null as any),
      );
      // simulate an error path instead
      mockPurchaseService.createReturn.mockReturnValue({
        subscribe: ({ error }: any) => error({ error: { errors: { items: ['Stock insuffisant.'] } } }),
      } as any);
      const savedSpy = vi.fn();
      comp.saved.subscribe(savedSpy);

      comp.submit();

      expect(comp.errorMessage()).toBe('Stock insuffisant.');
      expect(comp.submitting()).toBe(false);
      expect(savedSpy).not.toHaveBeenCalled();
    });
  });

  // ── Refonte 2b, 12c ────────────────────────────────────────────────────
  describe('le compteur − / +', () => {
    it('reste borné entre 0 et le retournable', () => {
      init([makePurchaseItem({ id: 1, quantity: 2 })]);
      comp.step(comp.lines()[0], -1);
      expect(comp.lines()[0].quantity).toBe(0);
      comp.step(comp.lines()[0], 1);
      comp.step(comp.lines()[0], 1);
      comp.step(comp.lines()[0], 1);
      expect(comp.lines()[0].quantity).toBe(2);
    });
  });

  describe('le motif', () => {
    it('envoie l\'option choisie, ou le texte libre sous « Autre »', () => {
      init([makePurchaseItem()]);
      expect(comp.reason()).toBe('Défaut de fabrication');
      comp.reasonChoice.set('Autre');
      expect(comp.reason()).toBeNull();
      comp.reasonOther.set('  Référence erronée ');
      expect(comp.reason()).toBe('Référence erronée');
    });
  });

  describe('la contrepartie', () => {
    it('déduit du dû par défaut, sans remboursement dans le corps envoyé', () => {
      init([makePurchaseItem({ id: 1, quantity: 10 })], [], [{ id: 1, amount: 500 }]);
      expect(comp.counterpart()).toBe('deduct');
      comp.setQuantity(comp.lines()[0], 1);
      mockPurchaseService.createReturn.mockReturnValue(of({} as PurchaseReturn));
      comp.submit();
      expect(mockPurchaseService.createReturn).toHaveBeenCalledWith(10, expect.objectContaining({ refund: null, reason: 'Défaut de fabrication' }));
    });

    it('refuse « Remboursement reçu » quand rien n\'a été payé', () => {
      init([makePurchaseItem()]);
      comp.setCounterpart('refund');
      expect(comp.counterpart()).toBe('deduct');
    });

    it('lit le payé net des remboursements sur la fiche quand elle le donne', () => {
      const ret: PurchaseReturn = {
        id: 1, purchase_id: 10, date: '2026-04-01', total_quantity: 1, total_amount: 100, refund_amount: 100,
        items: [{ id: 1, purchase_return_id: 1, purchase_item_id: 1, product_id: 5, stock_id: 5, quantity: 1, unit_price: 100 }],
      };
      init([makePurchaseItem({ id: 1, quantity: 10 })], [ret], [{ id: 1, amount: 9999 }], { paid_amount: 400 });
      expect(comp.availableToRefund()).toBe(400);
    });
  });

  describe('le dû avant et après', () => {
    it('baisse le dû fournisseur du montant retourné, net de la remise', () => {
      init([makePurchaseItem({ id: 1, quantity: 64, unit_price: 516 })], [], [],
        { net_amount: 33024, effective_net_amount: 33024, discount: 0, supplier: { id: 3, name: 'Michelin Maroc' } as any });
      comp.setQuantity(comp.lines()[0], 4);
      expect(mockSupplierService.getSupplierProfile).toHaveBeenCalledWith(3);
      expect(comp.supplierDue()).toBe(180500);
      expect(comp.supplierDueAfter()).toBe(178436);
    });

    it('ne déduit rien de ce qui est déjà réglé', () => {
      expect(returnDueEffect({ effectiveNet: 1000, netPaid: 1000, discountPct: 0, returnGross: 200 }))
        .toEqual({ before: 0, after: 0, deducted: 0, lost: 200 });
      expect(returnDueEffect({ effectiveNet: 1000, netPaid: 900, discountPct: 10, returnGross: 200 }))
        .toEqual({ before: 100, after: 0, deducted: 100, lost: 80 });
    });
  });
});
