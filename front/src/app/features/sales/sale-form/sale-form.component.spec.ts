import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { of } from 'rxjs';

import { SaleFormComponent } from './sale-form.component';
import { ProductService } from '../../../core/services/product.service';
import { StockService } from '../../../core/services/stock.service';
import { ClientService } from '../../clients/data-access/client.service';

const productServiceStub = { getProducts: () => of({ data: [] }) };
const stockServiceStub = { getStocks: () => of({ data: [] }) };
const clientServiceStub = {
  getClients: () => of([]),
  getClientProfile: () => of(null),
  createClient: () => of({}),
};

describe('SaleFormComponent', () => {
  let comp: SaleFormComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SaleFormComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: ProductService, useValue: productServiceStub },
        { provide: StockService, useValue: stockServiceStub },
        { provide: ClientService, useValue: clientServiceStub },
      ],
    }).compileComponents();

    comp = TestBed.createComponent(SaleFormComponent).componentInstance;
  });

  const oneItem = () => ({
    product_id: 1,
    stock_id: null,
    quantity: 2,
    purchase_price: 100,
    selling_price: 150,
    discount: 0,
    linkedProduct: null,
    stock: null,
  });

  describe('buildPayload — logistics fields', () => {
    it('includes carrier_id, tracking_number, partner_id and service in the emitted payload', () => {
      comp.formData = {
        ...comp.formData,
        commercial_id: 1,
        carrier_id: 5,
        tracking_number: 'TR-20260315-001',
        partner_id: 3,
        service: 'Montage inclus',
        items: [oneItem() as any],
      };

      const emitted: any[] = [];
      comp.save.subscribe((p) => emitted.push(p));
      comp.onSubmit();

      expect(emitted).toHaveLength(1);
      expect(emitted[0].carrier_id).toBe(5);
      expect(emitted[0].tracking_number).toBe('TR-20260315-001');
      expect(emitted[0].partner_id).toBe(3);
      expect(emitted[0].service).toBe('Montage inclus');
    });

    it('preserves logistics fields loaded from an existing sale', () => {
      comp.sale = {
        id: 42,
        date: '2026-03-15',
        commercial_id: 1,
        carrier_id: 7,
        tracking_number: 'TR-EXISTING',
        partner_id: 2,
        service: 'Alignement',
        items: [{ ...oneItem(), linkedProduct: null }],
      } as any;

      comp.ngOnInit();

      const emitted: any[] = [];
      comp.save.subscribe((p) => emitted.push(p));
      comp.onSubmit();

      expect(emitted).toHaveLength(1);
      expect(emitted[0].carrier_id).toBe(7);
      expect(emitted[0].tracking_number).toBe('TR-EXISTING');
      expect(emitted[0].partner_id).toBe(2);
      expect(emitted[0].service).toBe('Alignement');
    });

    it('allows null optional logistics fields when partner_id is set', () => {
      comp.formData = {
        ...comp.formData,
        commercial_id: 1,
        carrier_id: null,
        tracking_number: '',
        partner_id: 4,
        service: '',
        items: [oneItem() as any],
      };

      const emitted: any[] = [];
      comp.save.subscribe((p) => emitted.push(p));
      comp.onSubmit();

      expect(emitted).toHaveLength(1);
      expect(emitted[0].carrier_id).toBeNull();
      expect(emitted[0].tracking_number).toBe('');
      expect(emitted[0].partner_id).toBe(4);
      expect(emitted[0].service).toBe('');
    });
  });

  describe('onSubmit', () => {
    it('does not emit when items list is empty', () => {
      vi.spyOn(window, 'alert').mockReturnValue(undefined);
      comp.formData = { ...comp.formData, commercial_id: 1, partner_id: 1, items: [] };

      const emitted: any[] = [];
      comp.save.subscribe((p) => emitted.push(p));
      comp.onSubmit();

      expect(emitted).toHaveLength(0);
      vi.restoreAllMocks();
    });

    it('does not emit when commercial_id is missing', () => {
      vi.spyOn(window, 'alert').mockReturnValue(undefined);
      comp.formData = { ...comp.formData, commercial_id: null, partner_id: 1, items: [oneItem() as any] };

      const emitted: any[] = [];
      comp.save.subscribe((p) => emitted.push(p));
      comp.onSubmit();

      expect(emitted).toHaveLength(0);
      vi.restoreAllMocks();
    });

    it('does not emit when partner_id is missing', () => {
      vi.spyOn(window, 'alert').mockReturnValue(undefined);
      comp.formData = { ...comp.formData, commercial_id: 1, partner_id: null, items: [oneItem() as any] };

      const emitted: any[] = [];
      comp.save.subscribe((p) => emitted.push(p));
      comp.onSubmit();

      expect(emitted).toHaveLength(0);
      vi.restoreAllMocks();
    });
  });

  describe('statusOptions', () => {
    it('defaults to EN COURS transitions when formData.status is unset', () => {
      expect(comp.statusOptions).toEqual(['EN COURS', 'LIVRE', 'MONTE', 'ANNULE']);
    });

    it('lists LIVRE transitions with LIVRE kept first', () => {
      comp.formData.status = 'LIVRE';
      expect(comp.statusOptions).toEqual(['LIVRE', 'EN COURS', 'MONTE', 'TERMINEE']);
    });

    it('treats ANNULE as a dead end: only EN COURS is offered', () => {
      comp.formData.status = 'ANNULE';
      expect(comp.statusOptions).toEqual(['ANNULE', 'EN COURS']);
    });

    it('restricts TERMINEE to going back to LIVRE or MONTE only', () => {
      comp.formData.status = 'TERMINEE';
      expect(comp.statusOptions).toEqual(['TERMINEE', 'LIVRE', 'MONTE']);
    });
  });
});
