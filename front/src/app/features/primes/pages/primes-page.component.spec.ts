import { of, throwError } from 'rxjs';
import { PrimesPageComponent } from './primes-page.component';
import { PrimeDay, PrimeRow, PrimesResponse } from '../models/prime.model';

/** Septembre 2026 — 30 jours, on se place au 17. */
const TODAY = new Date(2026, 8, 17, 10, 0, 0);

function daysOf(month: number, year: number, values: Record<string, number> = {}): PrimeDay[] {
  const count = new Date(year, month, 0).getDate();
  return Array.from({ length: count }, (_, i) => {
    const date = `${year}-${`${month}`.padStart(2, '0')}-${`${i + 1}`.padStart(2, '0')}`;
    const total = values[date] ?? 0;
    return { date, sale_tyres: total, so_tyres: 0, total_tyres: total };
  });
}

function makeRow(overrides: Partial<PrimeRow> = {}): PrimeRow {
  return {
    commercial_id: 1,
    commercial_name: 'Karim Amrani',
    sale_tyres: 252,
    so_tyres: 32,
    total_tyres: 284,
    prime_per_tyre: 25,
    prime_total: 0,
    ...overrides,
  };
}

function makeResponse(overrides: Partial<PrimesResponse> = {}): PrimesResponse {
  return {
    year: 2026,
    month: 9,
    prime_threshold: 900,
    shop_total_tyres: 697,
    prime_eligible: false,
    summary: { total_primes: 0, total_commerciaux: 1 },
    data: [makeRow()],
    daily: daysOf(9, 2026),
    net_margin: 122_000,
    ...overrides,
  };
}

describe('PrimesPageComponent', () => {
  let comp: PrimesPageComponent;
  let mockService: { getPrimes: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TODAY);
    mockService = { getPrimes: vi.fn().mockReturnValue(of(makeResponse())) };
    comp = new PrimesPageComponent(mockService as never);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── L'objectif ─────────────────────────────────────────────────────────────

  describe('objectif collectif', () => {
    it('donne l’écart au seuil', () => {
      comp.ngOnInit();

      expect(comp.realized()).toBe(697);
      expect(comp.threshold()).toBe(900);
      expect(comp.gap()).toBe(203);
      expect(comp.reached()).toBe(false);
    });

    it('ne descend jamais sous zéro une fois le seuil franchi', () => {
      mockService.getPrimes.mockReturnValue(
        of(makeResponse({ shop_total_tyres: 1000, prime_eligible: true })),
      );
      comp.ngOnInit();

      expect(comp.gap()).toBe(0);
      expect(comp.reached()).toBe(true);
    });

    it('sans seuil configuré, il n’y a pas d’objectif à manquer', () => {
      mockService.getPrimes.mockReturnValue(of(makeResponse({ prime_threshold: 0 })));
      comp.ngOnInit();

      expect(comp.hasThreshold()).toBe(false);
      expect(comp.reached()).toBe(false);
      expect(comp.gap()).toBe(0);
    });
  });

  // ── Le rythme, mesuré et non extrapolé ─────────────────────────────────────

  describe('rythme', () => {
    it('compte les jours écoulés du mois en cours, pas le mois entier', () => {
      comp.ngOnInit();

      expect(comp.isCurrentMonth()).toBe(true);
      expect(comp.elapsedDays()).toBe(17);
      expect(comp.remainingDays()).toBe(13);
      expect(comp.currentPace()).toBeCloseTo(697 / 17, 6);
      expect(comp.requiredPace()).toBeCloseTo(203 / 13, 6);
    });

    it('sur un mois clos, tout le mois est écoulé et rien ne reste', () => {
      mockService.getPrimes.mockReturnValue(
        of(makeResponse({ month: 8, daily: daysOf(8, 2026) })),
      );
      comp.selectedMonth.set(8);
      comp.ngOnInit();

      expect(comp.isCurrentMonth()).toBe(false);
      expect(comp.elapsedDays()).toBe(31);
      expect(comp.remainingDays()).toBe(0);
      // Plus de jour restant : il n'y a plus de rythme à exiger.
      expect(comp.requiredPace()).toBeNull();
    });

    it('arrête le mois en cours à aujourd’hui, le mois clos à sa fin', () => {
      comp.ngOnInit();
      expect(comp.closingDate()).toBe('2026-09-17');
      expect(comp.formatDay(comp.closingDate())).toBe('17/09');

      mockService.getPrimes.mockReturnValue(
        of(makeResponse({ month: 8, daily: daysOf(8, 2026) })),
      );
      comp.selectedMonth.set(8);
      comp.loadData();
      expect(comp.closingDate()).toBe('2026-08-31');
    });
  });

  // ── Ce qui reste masqué ────────────────────────────────────────────────────

  describe('projection et historique', () => {
    it('ne projette pas : les jours de fermeture ne sont nulle part', () => {
      comp.ngOnInit();

      expect(comp.closingDays()).toBeNull();
      expect(comp.canProject()).toBe(false);
    });

    it('n’invente pas d’historique quand l’API n’en renvoie pas', () => {
      comp.ngOnInit();

      expect(comp.history()).toEqual([]);
    });

    it('affiche l’historique le jour où l’API le renvoie, seuil d’alors compris', () => {
      mockService.getPrimes.mockReturnValue(
        of(
          makeResponse({
            history: [
              { year: 2026, month: 8, shop_total_tyres: 661, prime_threshold: 600 },
              { year: 2026, month: 7, shop_total_tyres: 612, prime_threshold: 900 },
            ],
          }),
        ),
      );
      comp.ngOnInit();

      expect(comp.history()).toHaveLength(2);
      // Août est au-dessus de SON seuil, juillet non : la barre se cale sur le
      // seuil du mois, jamais sur celui d'aujourd'hui.
      expect(comp.histPct(comp.history()[0])).toBe(100);
      expect(comp.histPct(comp.history()[1])).toBeCloseTo((612 / 900) * 100, 6);
    });
  });

  // ── La jauge ───────────────────────────────────────────────────────────────

  describe('jauge', () => {
    it('cale l’échelle sur le seuil tant qu’il n’est pas atteint', () => {
      comp.ngOnInit();

      expect(comp.gaugeMax()).toBe(900);
      expect(comp.thresholdPct()).toBe(100);
      expect(comp.fillPct()).toBeCloseTo((697 / 900) * 100, 6);
    });

    it('recule le seuil dans la barre dès qu’il est dépassé', () => {
      mockService.getPrimes.mockReturnValue(
        of(makeResponse({ shop_total_tyres: 1200, prime_eligible: true })),
      );
      comp.ngOnInit();

      expect(comp.gaugeMax()).toBe(1200);
      expect(comp.thresholdPct()).toBe(75);
      expect(comp.fillPct()).toBe(100);
    });
  });

  // ── La répartition ─────────────────────────────────────────────────────────

  describe('répartition', () => {
    it('montre la prime au compteur actuel même quand rien n’est dû', () => {
      comp.ngOnInit();

      const row = comp.rows()[0];
      // prime_total vaut 0 côté API : le seuil n'est pas franchi.
      expect(row.prime_total).toBe(0);
      // La colonne « Prime si atteint » montre ce qui serait dû.
      expect(comp.primeIfReached(row)).toBe(284 * 25);
      expect(comp.costAtRealized()).toBe(284 * 25);
    });

    it('donne la part de chacun dans le total boutique', () => {
      comp.ngOnInit();

      expect(comp.sharePct(comp.rows()[0])).toBeCloseTo((284 / 697) * 100, 6);
    });

    it('totalise les colonnes ventes et service sur la ligne boutique', () => {
      mockService.getPrimes.mockReturnValue(
        of(
          makeResponse({
            data: [makeRow(), makeRow({ commercial_id: 2, sale_tyres: 100, so_tyres: 10, total_tyres: 110 })],
          }),
        ),
      );
      comp.ngOnInit();

      expect(comp.shopSaleTyres()).toBe(352);
      expect(comp.shopSoTyres()).toBe(42);
    });

    it('résume la règle quand tous les taux coïncident, pas sinon', () => {
      comp.ngOnInit();
      expect(comp.hasUniformRate()).toBe(true);
      expect(comp.uniformRate()).toBe(25);

      mockService.getPrimes.mockReturnValue(
        of(makeResponse({ data: [makeRow(), makeRow({ commercial_id: 2, prime_per_tyre: 30 })] })),
      );
      comp.loadData();
      expect(comp.hasUniformRate()).toBe(false);
      expect(comp.uniformRate()).toBeNull();
    });

    it('un taux uniforme de zéro reste une valeur, pas une absence', () => {
      mockService.getPrimes.mockReturnValue(
        of(makeResponse({ data: [makeRow({ prime_per_tyre: 0 })] })),
      );
      comp.ngOnInit();

      expect(comp.hasUniformRate()).toBe(true);
      expect(comp.uniformRate()).toBe(0);
    });
  });

  // ── Le coût ────────────────────────────────────────────────────────────────

  describe('coût de la prime', () => {
    it('rapporte le coût à la marge nette du mois', () => {
      comp.ngOnInit();

      expect(comp.marginShare()).toBeCloseTo((284 * 25) / 122_000 * 100, 6);
    });

    it('ne rapporte rien à une marge nette nulle ou négative', () => {
      mockService.getPrimes.mockReturnValue(of(makeResponse({ net_margin: -4000 })));
      comp.ngOnInit();

      expect(comp.marginShare()).toBeNull();
    });
  });

  // ── Les sous-lignes du repli ───────────────────────────────────────────────

  describe('sous-lignes', () => {
    it('la sous-ligne de repli porte les colonnes tombées, et elles seules', () => {
      comp.ngOnInit();
      const fold = comp.foldedSubLineFor(comp.rows()[0]);

      expect(fold).toContain('252');
      expect(fold).toContain('32');
      // Le total garde sa colonne sous 1200 px : l'y répéter serait le défaut
      // relevé sur les Charges RH.
      expect(fold).not.toContain('284');
    });

    it('la sous-ligne de fiche porte ce que le passage en fiche fait tomber', () => {
      comp.ngOnInit();
      const card = comp.cardSubLineFor(comp.rows()[0]);

      expect(card).toContain('284 pneus');
      expect(card).toContain('%');
    });
  });

  // ── Chargement ─────────────────────────────────────────────────────────────

  describe('chargement', () => {
    it('demande le mois sélectionné', () => {
      comp.ngOnInit();
      expect(mockService.getPrimes).toHaveBeenCalledWith(2026, 9);

      comp.prevMonth();
      expect(mockService.getPrimes).toHaveBeenLastCalledWith(2026, 8);
    });

    it('recule sur décembre de l’année précédente depuis janvier', () => {
      comp.selectedYear.set(2026);
      comp.selectedMonth.set(1);
      comp.prevMonth();

      expect(comp.selectedYear()).toBe(2025);
      expect(comp.selectedMonth()).toBe(12);
    });

    it('n’avance pas au-delà du mois en cours', () => {
      comp.ngOnInit();
      mockService.getPrimes.mockClear();

      comp.nextMonth();

      expect(mockService.getPrimes).not.toHaveBeenCalled();
      expect(comp.selectedMonth()).toBe(9);
    });

    it('un échec ne passe pas pour une absence de données', () => {
      mockService.getPrimes.mockReturnValue(throwError(() => ({ status: 0 })));
      comp.ngOnInit();

      expect(comp.loadError()).toBeTruthy();
      expect(comp.loading()).toBe(false);
    });
  });
});
