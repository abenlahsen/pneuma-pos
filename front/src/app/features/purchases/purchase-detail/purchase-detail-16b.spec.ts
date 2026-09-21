import { of } from 'rxjs';
import { PurchaseDetailComponent } from './purchase-detail.component';

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

function make(): PurchaseDetailComponent {
  const returns = { getReturns: vi.fn(() => of([])), deleteReturn: vi.fn() };
  const auth = { hasPermission: () => true };
  const comp = new PurchaseDetailComponent(returns as any, auth as any);
  comp.purchase = { id: 1, items: [], payments: [] } as any;
  return comp;
}

/**
 * Refonte 2b, gabarit 16b — côté achat, la colonne de droite ne parle pas de
 * marge mais de dette : combien reste-t-il à payer, depuis quand, et le délai
 * que le fournisseur accorde est-il dépassé.
 */
describe('PurchaseDetailComponent — gabarit 16b', () => {
  describe('le reste dû', () => {
    it('part du net, pas du brut', () => {
      const comp = make();
      comp.purchase = { ...comp.purchase, total_price: 5000, net_amount: 4500, payments: [] } as any;
      expect(comp.purchaseTotal).toBe(4500);
      expect(comp.amountDue).toBe(4500);
    });

    it('retombe sur le brut quand le net est absent', () => {
      const comp = make();
      comp.purchase = { ...comp.purchase, total_price: 5000, payments: [] } as any;
      expect(comp.purchaseTotal).toBe(5000);
    });

    it('retranche les règlements', () => {
      const comp = make();
      comp.purchase = { ...comp.purchase, net_amount: 4500, payments: [{ amount: 1500 }, { amount: 500 }] } as any;
      expect(comp.amountDue).toBe(2500);
    });
  });

  describe("l'âge du règlement", () => {
    it("compte les jours d'attente tant que l'achat n'est pas soldé", () => {
      const comp = make();
      comp.purchase = { ...comp.purchase, date: daysAgo(100), payment_status: 'NON PAYE' } as any;
      expect(comp.settlementAgeDays).toBeGreaterThanOrEqual(99);
    });

    it('ne dit rien sur un achat soldé', () => {
      const comp = make();
      comp.purchase = { ...comp.purchase, date: daysAgo(100), payment_status: 'PAYE' } as any;
      expect(comp.settlementAgeDays).toBeNull();
    });
  });

  describe('le délai fournisseur', () => {
    it("est nul quand la fiche fournisseur ne le renseigne pas", () => {
      const comp = make();
      comp.purchase = { ...comp.purchase, date: daysAgo(100), payment_status: 'NON PAYE', supplier: { id: 1, name: 'X' } } as any;
      expect(comp.contractualDays).toBeNull();
      // Sans délai connu, on ne peut pas parler de dépassement.
      expect(comp.daysOverTerms).toBeNull();
    });

    it('mesure le dépassement quand il est renseigné', () => {
      const comp = make();
      comp.purchase = {
        ...comp.purchase,
        date: daysAgo(100),
        payment_status: 'NON PAYE',
        supplier: { id: 1, name: 'X', payment_terms_days: 60 },
      } as any;
      expect(comp.contractualDays).toBe(60);
      expect(comp.daysOverTerms).toBeGreaterThanOrEqual(39);
      expect(comp.daysOverTerms).toBeLessThanOrEqual(41);
    });

    it('ne parle pas de dépassement tant que le délai court', () => {
      const comp = make();
      comp.purchase = {
        ...comp.purchase,
        date: daysAgo(10),
        payment_status: 'NON PAYE',
        supplier: { id: 1, name: 'X', payment_terms_days: 60 },
      } as any;
      expect(comp.daysOverTerms).toBeNull();
    });
  });

  describe('les retours', () => {
    it("somment ce qui est reparti chez le fournisseur", () => {
      const comp = make();
      comp.returns.set([{ total_amount: 300 }, { total_amount: 150.5 }] as any);
      expect(comp.returnedAmount).toBe(450.5);
    });

    it('valent zéro quand il n’y en a aucun', () => {
      expect(make().returnedAmount).toBe(0);
    });
  });
});
