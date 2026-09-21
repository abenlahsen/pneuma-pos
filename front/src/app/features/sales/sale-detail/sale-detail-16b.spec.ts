import { SaleDetailComponent } from './sale-detail.component';

/** Une date vieille de `days` jours, au format que renvoie l'API. */
function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

function make(permissions: string[] = ['view margins']): SaleDetailComponent {
  const auth = { hasPermission: (p: string) => permissions.includes(p) };
  const shipments = { getForSale: () => ({ subscribe: () => {} }) };
  const comp = new SaleDetailComponent(auth as any, shipments as any);
  comp.sale = { id: 1, items: [], payments: [] } as any;
  return comp;
}

/**
 * Refonte 2b, gabarit 16b — ce que la fiche de vente doit savoir dire d'elle
 * même une fois sortie de la modale : ce qui reste dû, depuis quand, et à qui
 * elle montre la marge.
 */
describe('SaleDetailComponent — gabarit 16b', () => {
  describe('le reste dû', () => {
    it('vaut le total quand rien n’a été payé', () => {
      const comp = make();
      comp.sale = { ...comp.sale, total_sale: 4800, payments: [] } as any;
      expect(comp.amountDue).toBe(4800);
    });

    it('retranche la somme des paiements', () => {
      const comp = make();
      comp.sale = { ...comp.sale, total_sale: 4800, payments: [{ amount: 1000 }, { amount: 2360.5 }] } as any;
      expect(comp.amountPaid).toBe(3360.5);
      expect(comp.amountDue).toBe(1439.5);
    });

    it('ne descend jamais sous zéro, même si la vente est sur-payée', () => {
      const comp = make();
      comp.sale = { ...comp.sale, total_sale: 100, payments: [{ amount: 150 }] } as any;
      expect(comp.amountDue).toBe(0);
    });

    it('lit total quand total_sale est absent', () => {
      const comp = make();
      comp.sale = { ...comp.sale, total: 900, payments: [] } as any;
      expect(comp.saleTotal).toBe(900);
    });

    it("n'accumule pas d'erreur de virgule flottante", () => {
      const comp = make();
      comp.sale = { ...comp.sale, total_sale: 0.3, payments: [{ amount: 0.1 }, { amount: 0.1 }] } as any;
      expect(comp.amountDue).toBe(0.1);
    });
  });

  describe("l'âge de la créance", () => {
    it('compte les jours depuis la vente tant qu’elle n’est pas soldée', () => {
      const comp = make();
      comp.sale = { ...comp.sale, date: daysAgo(77), payment_status: 'NON PAYE' } as any;
      expect(comp.unpaidDays).toBeGreaterThanOrEqual(76);
      expect(comp.unpaidDays).toBeLessThanOrEqual(78);
    });

    it('ne dit rien sur une vente soldée', () => {
      const comp = make();
      comp.sale = { ...comp.sale, date: daysAgo(77), payment_status: 'PAYE' } as any;
      expect(comp.unpaidDays).toBeNull();
      expect(comp.isSettled).toBe(true);
    });

    it('ne dit rien le jour même — « 0 J de retard » n’est pas un retard', () => {
      const comp = make();
      comp.sale = { ...comp.sale, date: new Date().toISOString().slice(0, 10), payment_status: 'NON PAYE' } as any;
      expect(comp.unpaidDays).toBeNull();
    });
  });

  describe('la marge', () => {
    it("n'est visible que sous la permission dédiée", () => {
      expect(make(['view margins']).canSeeMargin).toBe(true);
      expect(make([]).canSeeMargin).toBe(false);
      expect(make(['view sales']).canSeeMargin).toBe(false);
    });

    it('se calcule par ligne, prix de vente moins prix d’achat', () => {
      const comp = make();
      expect(comp.lineMargin({ total: 1000, purchase_price: 200, quantity: 4 })).toBe(200);
    });

    it('est négative quand la ligne a été vendue à perte', () => {
      const comp = make();
      expect(comp.lineMargin({ total: 600, purchase_price: 200, quantity: 4 })).toBe(-200);
    });
  });
});
