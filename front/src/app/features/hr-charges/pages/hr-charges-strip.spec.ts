import { of } from 'rxjs';
import { HrChargesPageComponent } from './hr-charges-page.component';
import { HrChargeSummary } from '../models/hr-charge.model';

function make(bySubcategory: Record<string, number>, total = 0): HrChargesPageComponent {
  const summary: HrChargeSummary = { total, by_subcategory: bySubcategory, employee_count: 0 };
  const service = {
    list: vi.fn().mockReturnValue(of({ data: [], total: 0 })),
    summary: vi.fn().mockReturnValue(of(summary)),
    filters: vi.fn().mockReturnValue(of({ employees: [], subcategories: [], accounts: [] })),
    createBatch: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
  const comp = new HrChargesPageComponent(service as any, { hasPermission: () => true } as any);
  comp.ngOnInit();
  return comp;
}

/**
 * Refonte 2b, 7c — la bande de synthèse.
 *
 * Elle était générée par *ngFor sur les sous-catégories : leur nombre est
 * illimité et la rangée cassait au-delà de quatre ou cinq. Elle est désormais
 * fixée à quatre cellules, et la répartition complète passe en barres dans la
 * colonne de droite.
 */
describe('HrChargesPageComponent — la bande fixe de 7c', () => {
  describe('subcategoryTotals', () => {
    it('classe du poste le plus lourd au plus léger', () => {
      const comp = make({ CNSS: 1200, Salaire: 6500, Prime: 3000 });
      expect(comp.subcategoryTotals().map((s) => s.name)).toEqual(['Salaire', 'Prime', 'CNSS']);
    });

    it('rend des montants numériques, pas les valeurs brutes de la réponse', () => {
      const comp = make({ Salaire: 6500 });
      expect(comp.subcategoryTotals()[0].amount).toBe(6500);
    });
  });

  describe('topSubcategories', () => {
    it("n'en retient que deux, quel qu'en soit le nombre", () => {
      const comp = make({ A: 100, B: 200, C: 300, D: 400, E: 500, F: 600 });
      expect(comp.topSubcategories().map((s) => s.name)).toEqual(['F', 'E']);
    });

    it('retient les deux plus lourdes, pas les deux premières venues', () => {
      const comp = make({ CNSS: 1200, Salaire: 6500, Prime: 3000 });
      expect(comp.topSubcategories().map((s) => s.name)).toEqual(['Salaire', 'Prime']);
    });
  });

  describe('emptyStripSlots', () => {
    // La bande doit rester à quatre cellules même un mois creux : sans cela,
    // elle rétrécirait et les chiffres changeraient de place d'un mois à l'autre.
    it('comble deux cellules quand aucune sous-catégorie', () => {
      expect(make({}).emptyStripSlots().length).toBe(2);
    });

    it("en comble une quand il n'y a qu'une sous-catégorie", () => {
      expect(make({ Salaire: 6500 }).emptyStripSlots().length).toBe(1);
    });

    it("n'en comble aucune dès qu'il y en a deux ou plus", () => {
      expect(make({ Salaire: 6500, Prime: 3000 }).emptyStripSlots().length).toBe(0);
      expect(make({ A: 1, B: 2, C: 3 }).emptyStripSlots().length).toBe(0);
    });
  });

  describe('barWidth', () => {
    it('rapporte chaque barre au poste le plus lourd du mois', () => {
      const comp = make({ Salaire: 6500, Prime: 3250, CNSS: 1300 });
      expect(comp.barWidth(6500)).toBe(100);
      expect(comp.barWidth(3250)).toBe(50);
      expect(comp.barWidth(1300)).toBe(20);
    });

    it('ne divise pas par zéro sur un mois sans charge', () => {
      expect(make({}).barWidth(0)).toBe(0);
    });
  });
});
