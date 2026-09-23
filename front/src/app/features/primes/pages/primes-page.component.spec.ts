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
    history: [],
    ...overrides,
  };
}

describe('PrimesPageComponent', () => {
  let comp: PrimesPageComponent;
  let mockService: { getPrimes: ReturnType<typeof vi.fn> };
  let mockSettings: { getCompanySettings: ReturnType<typeof vi.fn> };

  /** Fermée le dimanche, aucun férié — le réglage par défaut. */
  function settingsOf(closed: number[] = [0], holidays: string[] = []) {
    return of({ closed_weekdays: closed, holidays } as never);
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TODAY);
    mockService = { getPrimes: vi.fn().mockReturnValue(of(makeResponse())) };
    mockSettings = { getCompanySettings: vi.fn().mockReturnValue(settingsOf()) };
    comp = new PrimesPageComponent(mockService as never, mockSettings as never);
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
    // Septembre 2026 commence un mardi ; les dimanches tombent les 6, 13, 20
    // et 27. Au 17, il s'est écoulé 15 jours ouvrés et il en reste 11.
    it('compte en jours ouvrés, pas en jours calendaires', () => {
      comp.ngOnInit();

      expect(comp.isCurrentMonth()).toBe(true);
      expect(comp.elapsedDays()).toHaveLength(17);
      expect(comp.futureDays()).toHaveLength(13);
      expect(comp.workingDaysElapsed()).toBe(15);
      expect(comp.workingDaysRemaining()).toBe(11);
      expect(comp.currentPace()).toBeCloseTo(697 / 15, 6);
      expect(comp.requiredPace()).toBeCloseTo(203 / 11, 6);
    });

    it('retire aussi les fermetures exceptionnelles', () => {
      // Deux fériés en semaine, un troisième un dimanche déjà fermé : il ne
      // doit pas être compté deux fois.
      mockSettings.getCompanySettings.mockReturnValue(
        settingsOf([0], ['2026-09-10', '2026-09-24', '2026-09-13']),
      );
      comp.ngOnInit();

      expect(comp.workingDaysElapsed()).toBe(14);
      expect(comp.workingDaysRemaining()).toBe(10);
    });

    it('une boutique ouverte sept jours sur sept a autant de jours ouvrés que de jours', () => {
      mockSettings.getCompanySettings.mockReturnValue(settingsOf([]));
      comp.ngOnInit();

      expect(comp.workingDaysElapsed()).toBe(17);
      expect(comp.workingDaysRemaining()).toBe(13);
    });

    it('sur un mois clos, tout le mois est écoulé et rien ne reste', () => {
      mockService.getPrimes.mockReturnValue(
        of(makeResponse({ month: 8, daily: daysOf(8, 2026) })),
      );
      comp.selectedMonth.set(8);
      comp.ngOnInit();

      expect(comp.isCurrentMonth()).toBe(false);
      expect(comp.elapsedDays()).toHaveLength(31);
      expect(comp.futureDays()).toHaveLength(0);
      expect(comp.workingDaysRemaining()).toBe(0);
      // Plus de jour ouvré restant : il n'y a plus de rythme à exiger.
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

  describe('projection', () => {
    it('projette la fin du mois au rythme des jours ouvrés écoulés', () => {
      comp.ngOnInit();

      expect(comp.canProject()).toBe(true);
      // 697 + (697 / 15) × 11 = 1208, le chiffre de la maquette 18a.
      expect(comp.projectedTotal()).toBe(1208);
      expect(comp.projectionMakesIt()).toBe(true);
    });

    it('donne le jour ouvré où le compteur franchit le seuil', () => {
      comp.ngOnInit();

      // Il manque 203 pneus à 46,47 par jour ouvré, soit 4,4 jours ouvrés.
      // Les jours ouvrés restants sont 18, 19, 21 (dimanche 20 sauté), 22, 23 :
      // le plus proche du franchissement est le 4e, le 22.
      expect(comp.projectedDate()).toBe('2026-09-22');
    });

    it('saute les fériés comme les dimanches dans le compte à rebours', () => {
      // Le 21 devient férié : le 4e jour ouvré restant recule d'un cran.
      mockSettings.getCompanySettings.mockReturnValue(settingsOf([0], ['2026-09-21']));
      comp.ngOnInit();

      // Le 21 est à venir : les jours écoulés ne bougent pas, les restants si.
      expect(comp.workingDaysElapsed()).toBe(15);
      expect(comp.workingDaysRemaining()).toBe(10);
      expect(comp.projectedDate()).toBe('2026-09-23');
    });

    it('n’annonce pas de date quand le rythme ne suffit pas', () => {
      mockService.getPrimes.mockReturnValue(of(makeResponse({ shop_total_tyres: 120 })));
      comp.ngOnInit();

      expect(comp.projectedDate()).toBeNull();
      expect(comp.projectionMakesIt()).toBe(false);
    });

    it('ne projette rien tant que les jours de fermeture sont inconnus', () => {
      mockSettings.getCompanySettings.mockReturnValue(throwError(() => ({ status: 500 })));
      comp.ngOnInit();

      expect(comp.closingDays()).toBeNull();
      expect(comp.canProject()).toBe(false);
      expect(comp.projectedTotal()).toBeNull();
      expect(comp.projectedDate()).toBeNull();
      expect(comp.costAtProjection()).toBeNull();
    });

    it('ne projette pas un mois déjà clos', () => {
      mockService.getPrimes.mockReturnValue(
        of(makeResponse({ month: 8, daily: daysOf(8, 2026) })),
      );
      comp.selectedMonth.set(8);
      comp.ngOnInit();

      expect(comp.projectedTotal()).toBeNull();
    });

    it('met le coût à l’échelle de la projection', () => {
      comp.ngOnInit();

      expect(comp.costAtProjection()).toBeCloseTo((284 * 25 * 1208) / 697, 6);
    });
  });

  describe('historique', () => {
    it('compare chaque mois au seuil qui valait alors, pas à celui d’aujourd’hui', () => {
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

      const [aout, juillet] = comp.history();
      expect(comp.histReached(aout)).toBe(true);
      expect(comp.histReached(juillet)).toBe(false);
      expect(comp.histPct(aout)).toBe(100);
      expect(comp.histPct(juillet)).toBeCloseTo((612 / 900) * 100, 6);
      expect(comp.histLabel(aout)).toBe('Août');
    });

    it('un mois sans seuil connu n’a pas de verdict', () => {
      mockService.getPrimes.mockReturnValue(
        of(
          makeResponse({
            history: [
              { year: 2026, month: 8, shop_total_tyres: 661, prime_threshold: null },
              { year: 2026, month: 7, shop_total_tyres: 400, prime_threshold: null },
            ],
          }),
        ),
      );
      comp.ngOnInit();

      const [aout, juillet] = comp.history();
      expect(comp.histReached(aout)).toBe(false);
      expect(comp.histReached(juillet)).toBe(false);
      // Faute de seuil, les barres se calent sur le plus gros mois de la série
      // pour rester comparables entre elles.
      expect(comp.histPct(aout)).toBe(100);
      expect(comp.histPct(juillet)).toBeCloseTo((400 / 661) * 100, 6);
    });
  });

  // ── La jauge ───────────────────────────────────────────────────────────────

  describe('jauge', () => {
    it('fait tenir la projection dans l’échelle', () => {
      comp.ngOnInit();

      // Ce sont les proportions de la maquette 18a : 57,7 % de réalisé, le
      // seuil à 74,4 %, le reste en hachures.
      expect(comp.gaugeMax()).toBe(1208);
      expect(comp.fillPct()).toBeCloseTo((697 / 1208) * 100, 6);
      expect(comp.thresholdPct()).toBeCloseTo((900 / 1208) * 100, 6);
      expect(comp.projectionPct()).toBeCloseTo(100 - (697 / 1208) * 100, 6);
    });

    it('sans projection, le seuil est au bout de la barre', () => {
      mockSettings.getCompanySettings.mockReturnValue(throwError(() => ({ status: 500 })));
      comp.ngOnInit();

      expect(comp.gaugeMax()).toBe(900);
      expect(comp.thresholdPct()).toBe(100);
      expect(comp.fillPct()).toBeCloseTo((697 / 900) * 100, 6);
      expect(comp.projectionPct()).toBe(0);
    });

    it('recule le seuil dans la barre dès qu’il est dépassé', () => {
      // Un mois clos : pas de projection, l'échelle est le réalisé seul.
      mockService.getPrimes.mockReturnValue(
        of(makeResponse({ month: 8, daily: daysOf(8, 2026), shop_total_tyres: 1200, prime_eligible: true })),
      );
      comp.selectedMonth.set(8);
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
