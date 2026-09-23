import { of, throwError } from 'rxjs';
import { KpiHistoryPageComponent } from './kpi-history-page.component';
import { DashboardKpi, KpiSnapshot } from '../models/kpi-history.model';

/** Jeudi 17 septembre 2026. Les dimanches du mois : 6, 13, 20, 27. */
const TODAY = new Date(2026, 8, 17, 9, 0, 0);

function makeData(overrides: Partial<DashboardKpi> = {}): DashboardKpi {
  return {
    sales_today_amount: 71_240,
    tyres_today: 38,
    margin_today: 12_110,
    net_margin_today: 11_920,
    purchases_today_amount: 0,
    tyres_purchased_today: 0,
    expenses_today: 190,
    sales_month_amount: 1_197_880,
    purchases_month_amount: 902_500,
    margin_month: 204_520,
    net_margin_month: 108_120,
    expenses_month: 96_400,
    tyres_month: 655,
    parts_month: 84,
    tyres_purchased_month: 700,
    parts_purchased_month: 90,
    margin_year: 1_896_400,
    net_margin_year: 1_042_600,
    expenses_year: 853_800,
    total_sale_year: 10_842_300,
    total_purchase_year: 7_614_800,
    tyres_year: 5_871,
    parts_year: 740,
    tyres_purchased_year: 6_100,
    parts_purchased_year: 800,
    sales_by_commercial: [],
    sales_by_commercial_year: [],
    service_by_commercial: [],
    service_by_commercial_year: [],
    stock_quantity: 3_120,
    stock_value: 2_426_100,
    unpaid_sales: 271_600,
    unpaid_purchases: 412_000,
    cash_balance: 160_010,
    ...overrides,
  };
}

let nextId = 1;

function snapshotOn(date: string, data: Partial<DashboardKpi> = {}): KpiSnapshot {
  return {
    id: nextId++,
    snapshot_date: date,
    data: makeData(data),
    created_at: `${date}T23:59:00`,
  };
}

function responseOf(snapshots: KpiSnapshot[], lastPage = 1) {
  return of({
    data: snapshots,
    meta: { current_page: 1, last_page: lastPage, per_page: 30, total: snapshots.length },
  } as never);
}

describe('KpiHistoryPageComponent', () => {
  let comp: KpiHistoryPageComponent;
  let mockSvc: { getHistory: ReturnType<typeof vi.fn> };
  let mockSettings: { getCompanySettings: ReturnType<typeof vi.fn> };
  let navigated: unknown[][];
  let paramDate: string | null;

  function settingsOf(closed: number[] = [0], holidays: string[] = []) {
    return of({ closed_weekdays: closed, holidays } as never);
  }

  function build(): KpiHistoryPageComponent {
    const route = { paramMap: of({ get: () => paramDate } as never) };
    const router = {
      navigate: vi.fn((commands: unknown[]) => {
        navigated.push(commands);
        return Promise.resolve(true);
      }),
    };
    return new KpiHistoryPageComponent(
      mockSvc as never,
      mockSettings as never,
      route as never,
      router as never,
    );
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TODAY);
    nextId = 1;
    navigated = [];
    paramDate = 'latest';
    mockSvc = { getHistory: vi.fn().mockReturnValue(responseOf([])) };
    mockSettings = { getCompanySettings: vi.fn().mockReturnValue(settingsOf()) };
    comp = build();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Les trous ──────────────────────────────────────────────────────────────

  describe('la suite des jours', () => {
    it('remonte jusqu’à hier, pas jusqu’au dernier instantané', () => {
      // Rien depuis le 14 : la tâche planifiée est muette depuis trois jours.
      mockSvc.getHistory.mockReturnValue(responseOf([snapshotOn('2026-09-14')]));
      comp.ngOnInit();

      // Hier est le 16 : aujourd'hui ne peut pas avoir d'instantané, la tâche
      // tourne à 00:05 pour la veille.
      expect(comp.days()[0].date).toBe('2026-09-16');
      expect(comp.days().at(-1)!.date).toBe('2026-09-14');
    });

    it('qualifie un jour fermé et un jour ouvré sans instantané', () => {
      mockSvc.getHistory.mockReturnValue(
        responseOf([snapshotOn('2026-09-16'), snapshotOn('2026-09-12')]),
      );
      comp.ngOnInit();

      const byDate = new Map(comp.days().map((day) => [day.date, day.kind]));

      expect(byDate.get('2026-09-16')).toBe('snapshot');
      expect(byDate.get('2026-09-12')).toBe('snapshot');
      // Le 13 est un dimanche : fermeture normale.
      expect(byDate.get('2026-09-13')).toBe('closed');
      // Les 14 et 15 sont ouvrés : la tâche n'a pas tourné, ça doit se voir.
      expect(byDate.get('2026-09-14')).toBe('missing');
      expect(byDate.get('2026-09-15')).toBe('missing');
      expect(comp.missingCount()).toBe(2);
    });

    it('traite un jour férié comme une fermeture, pas comme une panne', () => {
      mockSettings.getCompanySettings.mockReturnValue(settingsOf([0], ['2026-09-15']));
      mockSvc.getHistory.mockReturnValue(
        responseOf([snapshotOn('2026-09-16'), snapshotOn('2026-09-14')]),
      );
      comp.ngOnInit();

      const byDate = new Map(comp.days().map((day) => [day.date, day.kind]));
      expect(byDate.get('2026-09-15')).toBe('closed');
      expect(comp.missingCount()).toBe(0);
    });

    it('sans jours de fermeture connus, un trou alerte plutôt que de rassurer', () => {
      mockSettings.getCompanySettings.mockReturnValue(throwError(() => ({ status: 500 })));
      mockSvc.getHistory.mockReturnValue(
        responseOf([snapshotOn('2026-09-16'), snapshotOn('2026-09-12')]),
      );
      comp.ngOnInit();

      const byDate = new Map(comp.days().map((day) => [day.date, day.kind]));
      // Le 13 est un dimanche, mais rien ne le dit : il compte comme manquant.
      expect(byDate.get('2026-09-13')).toBe('missing');
      expect(comp.missingCount()).toBe(3);
    });

    it('n’invente aucun jour quand il n’y a pas d’instantané du tout', () => {
      comp.ngOnInit();

      expect(comp.days()).toEqual([]);
      expect(comp.missingCount()).toBe(0);
    });

    it('ne remonte pas jusqu’à hier sur une page suivante', () => {
      mockSvc.getHistory.mockReturnValue(
        responseOf([snapshotOn('2026-09-10'), snapshotOn('2026-09-08')], 3),
      );
      comp.page.set(2);
      comp.ngOnInit();

      // La page 2 s'arrête à ses propres données : au-delà, ce n'est pas un
      // manque, c'est une autre page.
      expect(comp.days()[0].date).toBe('2026-09-10');
    });
  });

  // ── Sélection et navigation ────────────────────────────────────────────────

  describe('sélection', () => {
    it('résout « latest » vers le jour consultable le plus récent', () => {
      mockSvc.getHistory.mockReturnValue(
        responseOf([snapshotOn('2026-09-16'), snapshotOn('2026-09-15')]),
      );
      comp.ngOnInit();

      expect(navigated.at(-1)).toEqual(['/kpi-history', '2026-09-16']);
    });

    it('ne propose que les jours porteurs d’un instantané', () => {
      mockSvc.getHistory.mockReturnValue(
        responseOf([snapshotOn('2026-09-16'), snapshotOn('2026-09-12')]),
      );
      paramDate = '2026-09-16';
      comp = build();
      comp.ngOnInit();

      expect(comp.hasNewer()).toBe(false);
      expect(comp.hasOlder()).toBe(true);

      // Le pas suivant saute les 15, 14 et 13 : ils n'ont rien à montrer.
      comp.step(1);
      expect(navigated.at(-1)).toEqual(['/kpi-history', '2026-09-12']);
    });

    it('retombe sur le plus récent quand l’URL vise un jour sans instantané', () => {
      mockSvc.getHistory.mockReturnValue(responseOf([snapshotOn('2026-09-16')]));
      paramDate = '2026-09-13';
      comp = build();
      comp.ngOnInit();

      expect(navigated.at(-1)).toEqual(['/kpi-history', '2026-09-16']);
    });

    it('expose l’instantané sélectionné', () => {
      mockSvc.getHistory.mockReturnValue(
        responseOf([snapshotOn('2026-09-16', { tyres_today: 38 }), snapshotOn('2026-09-15')]),
      );
      paramDate = '2026-09-16';
      comp = build();
      comp.ngOnInit();

      expect(comp.selected()?.snapshot_date).toBe('2026-09-16');
      expect(comp.selected()?.data.tyres_today).toBe(38);
    });
  });

  // ── Le détail ──────────────────────────────────────────────────────────────

  describe('détail', () => {
    it('totalise le service auto en une ligne, sans le ventiler', () => {
      const data = makeData({
        service_by_commercial: [
          { commercial_name: 'Karim', total_ca: 100_000, total_orders: 60, total_margin: 30_000, total_unpaid: 5_000 },
          { commercial_name: 'Samira', total_ca: 42_300, total_orders: 36, total_margin: 16_100, total_unpaid: 3_200 },
        ],
      });

      const total = comp.serviceTotal(data)!;
      expect(total.ca).toBe(142_300);
      expect(total.orders).toBe(96);
      expect(total.margin).toBe(46_100);
      expect(total.unpaid).toBe(8_200);
      expect(total.rate).toBeCloseTo((46_100 / 142_300) * 100, 6);
    });

    it('n’affiche pas de ligne service quand il n’y a pas de service', () => {
      expect(comp.serviceTotal(makeData())).toBeNull();
    });

    it('laisse vide ce que l’instantané ne porte pas, sans recopier le mois', () => {
      const rows = comp.globalRows(makeData());
      const parts = rows.find((row) => row.label === 'Pièces vendues')!;

      expect(parts.today).toBe('—');
      expect(parts.month).not.toBe('—');
    });
  });

  // ── Période ────────────────────────────────────────────────────────────────

  describe('période', () => {
    it('décrit la période active en un jeton', () => {
      comp.filterFrom.set('2026-09-01');
      comp.filterTo.set('2026-09-15');

      expect(comp.hasPeriod()).toBe(true);
      expect(comp.periodLabel()).toBe('Du 01/09/2026 au 15/09/2026');
    });

    it('borne la liste sur la période plutôt que sur hier', () => {
      mockSvc.getHistory.mockReturnValue(responseOf([snapshotOn('2026-09-03')]));
      comp.filterFrom.set('2026-09-01');
      comp.filterTo.set('2026-09-04');
      comp.ngOnInit();

      expect(comp.days()[0].date).toBe('2026-09-04');
      expect(comp.days().at(-1)!.date).toBe('2026-09-01');
    });

    it('retirer le jeton relance sans période', () => {
      comp.filterFrom.set('2026-09-01');
      comp.filterTo.set('2026-09-15');
      comp.clearPeriod();

      expect(comp.hasPeriod()).toBe(false);
      expect(mockSvc.getHistory).toHaveBeenCalledWith(
        expect.objectContaining({ from: undefined, to: undefined, page: 1 }),
      );
    });
  });

  // ── Chargement ─────────────────────────────────────────────────────────────

  it('un échec ne passe pas pour une absence de données', () => {
    mockSvc.getHistory.mockReturnValue(throwError(() => ({ status: 0 })));
    comp.ngOnInit();

    expect(comp.loadError()).toBeTruthy();
    expect(comp.loading()).toBe(false);
  });
});
