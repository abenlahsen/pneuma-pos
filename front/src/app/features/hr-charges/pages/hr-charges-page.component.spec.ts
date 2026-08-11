import { of, throwError } from 'rxjs';
import { HrChargesPageComponent } from './hr-charges-page.component';
import { HrCharge, HrChargeFilters, HrChargeSummary } from '../models/hr-charge.model';

function makeCharge(overrides: Partial<HrCharge> = {}): HrCharge {
  return {
    id: 1,
    date: '2026-07-15',
    employee_id: 1,
    employee_name: 'A. Bennani',
    subcategory: 'Salaires',
    amount: 6500,
    method: 'Virement',
    description: null,
    account: { id: 1, name: 'Banque' },
    ...overrides,
  };
}

const emptyFilters: HrChargeFilters = { employees: [], subcategories: [], accounts: [] };

describe('HrChargesPageComponent', () => {
  let comp: HrChargesPageComponent;
  let mockService: {
    list: ReturnType<typeof vi.fn>;
    summary: ReturnType<typeof vi.fn>;
    filters: ReturnType<typeof vi.fn>;
    createBatch: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  const mockAuthService = { hasPermission: () => true };

  beforeEach(() => {
    mockService = {
      list: vi.fn().mockReturnValue(of({ data: [], total: 0 })),
      summary: vi.fn().mockReturnValue(of({ total: 0, by_subcategory: {}, employee_count: 0 })),
      filters: vi.fn().mockReturnValue(of(emptyFilters)),
      createBatch: vi.fn(),
      delete: vi.fn(),
    };
    comp = new HrChargesPageComponent(mockService as any, mockAuthService as any);
  });

  describe('ngOnInit', () => {
    it('loads filters and the current month data', () => {
      comp.ngOnInit();

      expect(mockService.filters).toHaveBeenCalled();
      expect(mockService.list).toHaveBeenCalledWith(comp.selectedYear(), comp.selectedMonth(), null, null);
      expect(mockService.summary).toHaveBeenCalledWith(comp.selectedYear(), comp.selectedMonth(), null, null);
    });

    it('populates charges and summary from the responses', () => {
      const charge = makeCharge();
      const summary: HrChargeSummary = { total: 6500, by_subcategory: { Salaires: 6500 }, employee_count: 1 };
      mockService.list.mockReturnValue(of({ data: [charge], total: 1 }));
      mockService.summary.mockReturnValue(of(summary));

      comp.ngOnInit();

      expect(comp.charges()).toEqual([charge]);
      expect(comp.summary()).toEqual(summary);
      expect(comp.subcategoryTotals()).toEqual([{ name: 'Salaires', amount: 6500 }]);
    });
  });

  describe('month navigation', () => {
    it('prevMonth steps back a month and reloads', () => {
      comp.selectedYear.set(2026);
      comp.selectedMonth.set(7);

      comp.prevMonth();

      expect(comp.selectedMonth()).toBe(6);
      expect(comp.selectedYear()).toBe(2026);
      expect(mockService.list).toHaveBeenCalledWith(2026, 6, null, null);
    });

    it('prevMonth rolls over to December of the previous year from January', () => {
      comp.selectedYear.set(2026);
      comp.selectedMonth.set(1);

      comp.prevMonth();

      expect(comp.selectedMonth()).toBe(12);
      expect(comp.selectedYear()).toBe(2025);
    });

    it('nextMonth does nothing when already on the current month', () => {
      comp.selectedYear.set(comp.currentYear);
      comp.selectedMonth.set(comp.currentMonth);
      mockService.list.mockClear();

      comp.nextMonth();

      expect(mockService.list).not.toHaveBeenCalled();
    });

    it('nextMonth advances a month and reloads when not on the current month', () => {
      comp.selectedYear.set(2026);
      comp.selectedMonth.set(6);

      comp.nextMonth();

      expect(comp.selectedMonth()).toBe(7);
      expect(mockService.list).toHaveBeenCalledWith(2026, 7, null, null);
    });
  });

  describe('filters', () => {
    it('applyFilters passes the selected employee and subcategory to the service', () => {
      comp.filterEmployeeId.set(5);
      comp.filterSubcategory.set('CNSS (part patronale)');

      comp.applyFilters();

      expect(mockService.list).toHaveBeenCalledWith(comp.selectedYear(), comp.selectedMonth(), 5, 'CNSS (part patronale)');
    });
  });

  describe('submitBatch', () => {
    it('closes the form and reloads on success', () => {
      mockService.createBatch.mockReturnValue(of([makeCharge()]));
      comp.showForm.set(true);

      comp.submitBatch({ lines: [] });

      expect(comp.showForm()).toBe(false);
      expect(mockService.list).toHaveBeenCalled();
    });

    it('surfaces an API error without closing the form', () => {
      mockService.createBatch.mockReturnValue(throwError(() => ({ error: { message: 'Erreur serveur.' } })));
      comp.showForm.set(true);

      comp.submitBatch({ lines: [] });

      expect(comp.errorMessage()).toBe('Erreur serveur.');
      expect(comp.showForm()).toBe(true);
    });
  });

  describe('deleteCharge', () => {
    let confirmSpy: ReturnType<typeof vi.spyOn>;
    afterEach(() => confirmSpy.mockRestore());

    it('does not call the API when the user cancels the confirmation', () => {
      confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

      comp.deleteCharge(makeCharge());

      expect(mockService.delete).not.toHaveBeenCalled();
    });

    it('reloads the data after a successful delete', () => {
      confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
      mockService.delete.mockReturnValue(of(undefined));
      mockService.list.mockClear();

      comp.deleteCharge(makeCharge());

      expect(mockService.delete).toHaveBeenCalledWith(1);
      expect(mockService.list).toHaveBeenCalled();
    });
  });
});
