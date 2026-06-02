import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { of, throwError } from 'rxjs';

import { ServicePaymentPanelComponent } from './service-payment-panel.component';
import { ServiceOrderService } from '../data-access/service-order.service';
import { AuthService } from '../../../core/services/auth.service';

const defaultPaymentsResponse = {
  payments: [],
  total_paid: 0,
  total_amount: 500,
  remaining: 500,
  payment_status: 'NON PAYE',
};

const serviceOrderServiceStub = {
  getPayments: () => of(defaultPaymentsResponse),
  getFilters: () => of({ accounts: [{ id: 1, name: 'Caisse', type: 'cash' }] }),
  addPayment: () => of({ id: 1, amount: 200 }),
  deletePayment: () => of(null),
};

const authServiceStub = {
  hasPermission: () => true,
};

describe('ServicePaymentPanelComponent', () => {
  let comp: ServicePaymentPanelComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ServicePaymentPanelComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: ServiceOrderService, useValue: { ...serviceOrderServiceStub } },
        { provide: AuthService, useValue: authServiceStub },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ServicePaymentPanelComponent);
    comp = fixture.componentInstance;
    comp.serviceOrder = { id: 42, net_amount: 500 } as any;
    fixture.detectChanges();
  });

  // -------------------------------------------------------------------------
  // progressPercent
  // -------------------------------------------------------------------------

  describe('progressPercent', () => {
    it('returns 0 when totalAmount is 0', () => {
      comp.totalAmount.set(0);
      comp.totalPaid.set(100);
      expect(comp.progressPercent).toBe(0);
    });

    it('calculates percentage correctly', () => {
      comp.totalAmount.set(500);
      comp.totalPaid.set(250);
      expect(comp.progressPercent).toBe(50);
    });

    it('clamps to 100 on overpayment', () => {
      comp.totalAmount.set(500);
      comp.totalPaid.set(600);
      expect(comp.progressPercent).toBe(100);
    });

    it('rounds to integer', () => {
      comp.totalAmount.set(300);
      comp.totalPaid.set(100);
      expect(comp.progressPercent).toBe(33);
    });
  });

  // -------------------------------------------------------------------------
  // openAddForm
  // -------------------------------------------------------------------------

  describe('openAddForm', () => {
    it('sets showAddForm to true', () => {
      comp.showAddForm = false;
      comp.remaining.set(300);
      comp.openAddForm();
      expect(comp.showAddForm).toBe(true);
    });

    it('pre-fills formData.amount with remaining', () => {
      comp.remaining.set(350);
      comp.openAddForm();
      expect(comp.formData.amount).toBe(350);
    });

    it('clamps amount to 0 when remaining is negative', () => {
      comp.remaining.set(-50);
      comp.openAddForm();
      expect(comp.formData.amount).toBe(0);
    });

    it('resets method to Espèces', () => {
      comp.formData.method = 'Chèque';
      comp.openAddForm();
      expect(comp.formData.method).toBe('Espèces');
    });
  });

  // -------------------------------------------------------------------------
  // close
  // -------------------------------------------------------------------------

  describe('close', () => {
    it('emits the closed event', () => {
      let count = 0;
      comp.closed.subscribe(() => count++);
      comp.close();
      expect(count).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // ngOnInit — loads payments and accounts (default stub)
  // -------------------------------------------------------------------------

  describe('ngOnInit', () => {
    it('populates signals from getPayments response', () => {
      expect(comp.totalPaid()).toBe(0);
      expect(comp.totalAmount()).toBe(500);
      expect(comp.remaining()).toBe(500);
      expect(comp.paymentStatus()).toBe('NON PAYE');
      expect(comp.payments()).toHaveLength(0);
      expect(comp.loading()).toBe(false);
    });

    it('populates accounts from getFilters response', () => {
      expect(comp.accounts()).toHaveLength(1);
      expect(comp.accounts()[0].name).toBe('Caisse');
    });
  });

  // -------------------------------------------------------------------------
  // paymentMethods
  // -------------------------------------------------------------------------

  describe('paymentMethods', () => {
    it('includes standard payment methods', () => {
      expect(comp.paymentMethods).toContain('Espèces');
      expect(comp.paymentMethods).toContain('Chèque');
      expect(comp.paymentMethods).toContain('Virement');
      expect(comp.paymentMethods).toContain('Carte bancaire');
    });
  });
});
