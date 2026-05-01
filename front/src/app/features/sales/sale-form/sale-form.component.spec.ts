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

    it('sets null logistics fields when not provided', () => {
      comp.formData = {
        ...comp.formData,
        carrier_id: null,
        tracking_number: '',
        partner_id: null,
        service: '',
        items: [oneItem() as any],
      };

      const emitted: any[] = [];
      comp.save.subscribe((p) => emitted.push(p));
      comp.onSubmit();

      expect(emitted[0].carrier_id).toBeNull();
      expect(emitted[0].tracking_number).toBe('');
      expect(emitted[0].partner_id).toBeNull();
      expect(emitted[0].service).toBe('');
    });
  });

  describe('onSubmit', () => {
    it('does not emit when items list is empty', () => {
      vi.spyOn(window, 'alert').mockReturnValue(undefined);
      comp.formData = { ...comp.formData, items: [] };

      const emitted: any[] = [];
      comp.save.subscribe((p) => emitted.push(p));
      comp.onSubmit();

      expect(emitted).toHaveLength(0);
      vi.restoreAllMocks();
    });
  });
});
