import { of, throwError } from 'rxjs';
import { ReportingPageComponent } from './reporting-page.component';
import { MonthlyReport, ReportPeriodData } from '../models/reporting.model';

function makePeriod(overrides: Partial<ReportPeriodData> = {}): ReportPeriodData {
  return {
    sales: { total: 1300, with_invoice: 800, without_invoice: 500, count: 2, avg_basket: 650, gross_margin: 600, tyres_qty: 2, parts_qty: 0, avg_price_per_tyre: 400, unpaid_generated: 500 },
    purchases: { total: 1300, with_invoice: 900, without_invoice: 400, count: 2, tyres_qty: 4, parts_qty: 0, returns_count: 0, returns_amount: 0, refunds_received: 0, unpaid_generated: 1300 },
    service_orders: { revenue: 200, count: 1, gross_margin: 200, collected: 0, tyres_qty: 0 },
    margin: { sales: 600, service: 200, other_revenue: 0, gross: 800, rate: 53.3, expenses: 6800, net: -6000 },
    collections: { total: 300, with_invoice: 300, without_invoice: 0, unallocated: 0, by_method: { 'Espèces': 300 }, service_orders: 0 },
    supplier_payments: { total: 150, with_invoice: 100, without_invoice: 50, unallocated: 0, by_method: { 'Virement': 150 } },
    expenses: { total: 6800, by_category: [{ category: 'Charges RH', amount: 6500, share: 95.6 }, { category: 'Charge', amount: 300, share: 4.4 }] },
    payroll: { total: 6500, by_subcategory: { Salaire: 6500 }, employee_count: 1 },
    cash_flow: { income_settled: 0, expense_settled: 6800, net: -6800, pending_income: 0, pending_expense: 0 },
    commercials: [{ commercial_name: 'Admin', sales_count: 2, total_sales: 1300, total_tyres: 2, total_margin: 600, margin_rate: 46.2, total_unpaid: 500 }],
    top_brands: [{ brand: 'ReportBrand', tyres_qty: 2, total_sales: 800 }],
    clients: { new_count: 3 },
    ...overrides,
  };
}

function makeReport(): MonthlyReport {
  return {
    period: { year: 2026, month: 8, start: '2026-08-01', end: '2026-08-31' },
    previous_period: { year: 2026, month: 7, start: '2026-07-01', end: '2026-07-31' },
    current: makePeriod(),
    previous: makePeriod({
      sales: { total: 1000, with_invoice: 500, without_invoice: 500, count: 1, avg_basket: 1000, gross_margin: 400, tyres_qty: 4, parts_qty: 0, avg_price_per_tyre: 250, unpaid_generated: 0 },
      expenses: { total: 5000, by_category: [{ category: 'Charges RH', amount: 5000, share: 100 }] },
      payroll: { total: 5000, by_subcategory: { Salaire: 4000, CNSS: 1000 }, employee_count: 1 },
    }),
  };
}

describe('ReportingPageComponent', () => {
  let comp: ReportingPageComponent;
  let mockService: { getMonthly: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockService = { getMonthly: vi.fn().mockReturnValue(of(makeReport())) };
    comp = new ReportingPageComponent(mockService as any);
  });

  describe('loading', () => {
    it('loads the selected month on init', () => {
      comp.selectedYear.set(2026);
      comp.selectedMonth.set(8);

      comp.ngOnInit();

      expect(mockService.getMonthly).toHaveBeenCalledWith(2026, 8);
      expect(comp.report()).not.toBeNull();
      expect(comp.loading()).toBe(false);
      expect(comp.cur()?.sales.total).toBe(1300);
      expect(comp.previousLabel()).toBe('Juillet 2026');
    });

    it('surfaces an error message when the API fails', () => {
      mockService.getMonthly.mockReturnValue(throwError(() => new Error('boom')));

      comp.loadData();

      expect(comp.loading()).toBe(false);
      expect(comp.error()).toContain('Impossible de charger');
      expect(comp.sections()).toEqual([]);
    });
  });

  describe('month navigation', () => {
    it('prevMonth rolls from January back to December of the previous year', () => {
      comp.selectedYear.set(2026);
      comp.selectedMonth.set(1);

      comp.prevMonth();

      expect(comp.selectedMonth()).toBe(12);
      expect(comp.selectedYear()).toBe(2025);
      expect(mockService.getMonthly).toHaveBeenCalledWith(2025, 12);
    });

    it('nextMonth rolls from December to January of the next year', () => {
      comp.selectedYear.set(comp.currentYear - 1);
      comp.selectedMonth.set(12);

      comp.nextMonth();

      expect(comp.selectedMonth()).toBe(1);
      expect(comp.selectedYear()).toBe(comp.currentYear);
    });

    it('nextMonth is blocked on the current month', () => {
      comp.selectedYear.set(comp.currentYear);
      comp.selectedMonth.set(comp.currentMonth);

      comp.nextMonth();

      expect(comp.isCurrentMonth()).toBe(true);
      expect(mockService.getMonthly).not.toHaveBeenCalled();
    });
  });

  describe('delta helpers', () => {
    it('returns null when there is no baseline', () => {
      expect(comp.delta(100, 0)).toBeNull();
      expect(comp.deltaLabel(100, 0)).toBe('—');
      expect(comp.deltaClass(100, 0)).toBe('none');
    });

    it('computes a signed percentage change', () => {
      expect(comp.delta(1300, 1000)).toBe(30);
      expect(comp.delta(750, 1000)).toBe(-25);
      expect(comp.delta(-500, -1000)).toBe(50);
    });

    it('colours the badge according to the tone', () => {
      expect(comp.deltaClass(1300, 1000, 'up-good')).toBe('good');
      expect(comp.deltaClass(750, 1000, 'up-good')).toBe('bad');
      expect(comp.deltaClass(1300, 1000, 'up-bad')).toBe('bad');
      expect(comp.deltaClass(750, 1000, 'up-bad')).toBe('good');
      expect(comp.deltaClass(1300, 1000, 'neutral')).toBe('neutral');
      expect(comp.deltaClass(1000, 1000)).toBe('neutral');
    });
  });

  describe('derived rows', () => {
    beforeEach(() => comp.loadData());

    it('builds one section per report family with the current and previous values', () => {
      const keys = comp.sections().map(s => s.key);
      expect(keys).toEqual(['sales', 'purchases', 'margin', 'payments', 'payroll', 'service', 'cash']);

      const caCard = comp.sections()[0].cards[0];
      expect(caCard.label).toBe('CA Ventes');
      expect(caCard.value).toBe(1300);
      expect(caCard.prev).toBe(1000);
    });

    it('pairs each expense category with its previous-month amount', () => {
      expect(comp.expenseRows()).toEqual([
        { label: 'Charges RH', value: 6500, prev: 5000, share: 95.6 },
        { label: 'Charge', value: 300, prev: 0, share: 4.4 },
      ]);
    });

    it('computes payroll shares and previous amounts per subcategory', () => {
      expect(comp.payrollRows()).toEqual([{ label: 'Salaire', value: 6500, prev: 4000, share: 100 }]);
    });

    it('merges collection and supplier payment methods into one table', () => {
      expect(comp.methodRows()).toEqual([
        { method: 'Espèces', collections: 300, supplierPayments: 0 },
        { method: 'Virement', collections: 0, supplierPayments: 150 },
      ]);
    });
  });
});
