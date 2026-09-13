import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';

import { SaleFormComponent } from './sale-form.component';
import { ProductService } from '../../../core/services/product.service';
import { StockService } from '../../../core/services/stock.service';
import { ClientService } from '../../clients/data-access/client.service';
import { CityService } from '../../../core/services/city.service';
import { SalePrestationService } from '../data-access/sale-prestation.service';
import { SalePrestationCatalog } from '../models/sale.model';

const productServiceStub = { getProducts: () => of({ data: [] }) };
const stockServiceStub = { getStocks: () => of({ data: [] }) };
const clientServiceStub = {
  getClients: () => of([]),
  getClientProfile: () => of(null),
  createClient: () => of({}),
};
const cityServiceStub = { getCities: () => of([]) };
const emptyPrestationCatalog: SalePrestationCatalog = { montage: null, alignment_vt: null, alignment_suv: null };
const prestationServiceStub: { getCatalog: () => Observable<SalePrestationCatalog> } = {
  getCatalog: () => of(emptyPrestationCatalog),
};

describe('SaleFormComponent', () => {
  let comp: SaleFormComponent;

  beforeEach(async () => {
    prestationServiceStub.getCatalog = () => of(emptyPrestationCatalog);

    await TestBed.configureTestingModule({
      imports: [SaleFormComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: ProductService, useValue: productServiceStub },
        { provide: StockService, useValue: stockServiceStub },
        { provide: ClientService, useValue: clientServiceStub },
        { provide: CityService, useValue: cityServiceStub },
        { provide: SalePrestationService, useValue: prestationServiceStub },
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

  describe('prestations', () => {
    const tyreItem = (quantity: number) => ({
      product_id: 1,
      stock_id: 10,
      quantity,
      purchase_price: 100,
      selling_price: 150,
      discount: 0,
      linkedProduct: { id: 1, type: 'tyre' },
      stock: null,
    });

    it('tyreQuantity() counts only tyre lines, not service lines', () => {
      comp.formData.items = [
        tyreItem(4) as any,
        { product_id: 2, quantity: 1, linkedProduct: { id: 2, type: 'service' } } as any,
      ];

      expect(comp.tyreQuantity()).toBe(4);
    });

    it('adds a montage line sized to the tyre quantity when toggled on', () => {
      prestationServiceStub.getCatalog = () => of({
        montage: { product_id: 901, label: 'Montage + Équilibrage', default_price: 30 },
        alignment_vt: null,
        alignment_suv: null,
      });
      comp.ngOnInit();
      comp.formData.items = [tyreItem(4) as any];

      comp.onMontageToggle(true);

      const line: any = comp.formData.items!.find((i: any) => i.product_id === 901);
      expect(line).toBeTruthy();
      expect(line.quantity).toBe(4);
      expect(line.stock_id).toBeNull();
    });

    it('removes the montage line when toggled back off', () => {
      prestationServiceStub.getCatalog = () => of({
        montage: { product_id: 901, label: 'Montage + Équilibrage', default_price: 30 },
        alignment_vt: null,
        alignment_suv: null,
      });
      comp.ngOnInit();
      comp.formData.items = [tyreItem(4) as any];

      comp.onMontageToggle(true);
      comp.onMontageToggle(false);

      expect(comp.formData.items!.some((i: any) => i.product_id === 901)).toBe(false);
    });

    it('sets a 100% discount on the montage line when marked offert', () => {
      prestationServiceStub.getCatalog = () => of({
        montage: { product_id: 901, label: 'Montage + Équilibrage', default_price: 30 },
        alignment_vt: null,
        alignment_suv: null,
      });
      comp.ngOnInit();
      comp.formData.items = [tyreItem(4) as any];

      comp.onMontageToggle(true);
      comp.onMontageOffertToggle(true);

      const line: any = comp.formData.items!.find((i: any) => i.product_id === 901);
      expect(line.discount).toBe(100);
    });

    it('pre-fills the montage price from the selected partner but keeps a manually entered price', () => {
      prestationServiceStub.getCatalog = () => of({
        montage: { product_id: 901, label: 'Montage + Équilibrage', default_price: 30 },
        alignment_vt: null,
        alignment_suv: null,
      });
      comp.ngOnInit();
      comp.partners.set([{ id: 9, name: 'Partenaire', montage_price: 45 } as any]);
      comp.formData.partner_id = 9;
      comp.formData.items = [tyreItem(2) as any];

      comp.onMontageToggle(true);
      let line: any = comp.formData.items!.find((i: any) => i.product_id === 901);
      expect(line.selling_price).toBe(45);

      comp.onMontagePriceChange(60);
      comp.onPartnerChange(9);

      line = comp.formData.items!.find((i: any) => i.product_id === 901);
      expect(line.selling_price).toBe(60);
    });

    it('switches the parallélisme product and re-prices it from the partner when the vehicle type changes', () => {
      prestationServiceStub.getCatalog = () => of({
        montage: null,
        alignment_vt: { product_id: 902, label: 'Parallélisme — Tourisme', default_price: 100 },
        alignment_suv: { product_id: 903, label: 'Parallélisme — SUV / 4x4', default_price: 150 },
      });
      comp.ngOnInit();
      comp.partners.set([{ id: 9, name: 'Partenaire', alignment_price: 100, alignment_price_suv: 150 } as any]);
      comp.formData.partner_id = 9;
      comp.formData.items = [];

      comp.onParalToggle(true);
      let line: any = comp.formData.items!.find((i: any) => i.product_id === 902);
      expect(line).toBeTruthy();
      expect(line.selling_price).toBe(100);

      comp.onParalTypeChange('suv');

      expect(comp.formData.items!.some((i: any) => i.product_id === 902)).toBe(false);
      line = comp.formData.items!.find((i: any) => i.product_id === 903);
      expect(line).toBeTruthy();
      expect(line.selling_price).toBe(150);
    });

    it('hydrates the encart from an existing sale line on load', () => {
      prestationServiceStub.getCatalog = () => of({
        montage: { product_id: 901, label: 'Montage + Équilibrage', default_price: 30 },
        alignment_vt: null,
        alignment_suv: null,
      });

      comp.sale = {
        id: 10,
        date: '2026-03-15',
        items: [
          { product_id: 901, stock_id: null, quantity: 4, selling_price: 30, discount: 100, linkedProduct: null },
        ],
      } as any;

      comp.ngOnInit();

      expect(comp.montageOn()).toBe(true);
      expect(comp.montageOffert()).toBe(true);
      expect(comp.montagePrice()).toBe(30);
    });

    it('unchecking a prestation via removeItem() does not leave the line behind', () => {
      prestationServiceStub.getCatalog = () => of({
        montage: { product_id: 901, label: 'Montage + Équilibrage', default_price: 30 },
        alignment_vt: null,
        alignment_suv: null,
      });
      comp.ngOnInit();
      comp.formData.items = [tyreItem(4) as any];
      comp.onMontageToggle(true);

      const index = comp.formData.items!.findIndex((i: any) => i.product_id === 901);
      comp.removeItem(index);

      expect(comp.montageOn()).toBe(false);
      expect(comp.formData.items!.some((i: any) => i.product_id === 901)).toBe(false);
    });

    it('exposes availability flags matching the loaded catalog', () => {
      prestationServiceStub.getCatalog = () => of({
        montage: { product_id: 901, label: 'Montage + Équilibrage', default_price: 30 },
        alignment_vt: null,
        alignment_suv: { product_id: 903, label: 'Parallélisme — SUV / 4x4', default_price: 150 },
      });
      comp.ngOnInit();

      expect(comp.isMontageAvailable()).toBe(true);
      expect(comp.isParalAvailable()).toBe(true);
      expect(comp.isParalTypeAvailable('vt')).toBe(false);
      expect(comp.isParalTypeAvailable('suv')).toBe(true);
    });

    it('refuses to turn on montage when the catalog has no montage entry (avoids a phantom total)', () => {
      prestationServiceStub.getCatalog = () => of({ montage: null, alignment_vt: null, alignment_suv: null });
      comp.ngOnInit();
      comp.formData.items = [tyreItem(4) as any];

      comp.onMontageToggle(true);

      expect(comp.montageOn()).toBe(false);
      expect(comp.formData.items!.some((i: any) => i.quantity === 4 && i.product_id !== 1)).toBe(false);
    });

    it('refuses to turn on parallélisme when neither VT nor SUV is configured', () => {
      prestationServiceStub.getCatalog = () => of({ montage: null, alignment_vt: null, alignment_suv: null });
      comp.ngOnInit();

      comp.onParalToggle(true);

      expect(comp.paralOn()).toBe(false);
    });

    it('auto-selects the available parallélisme type when only SUV is configured', () => {
      prestationServiceStub.getCatalog = () => of({
        montage: null,
        alignment_vt: null,
        alignment_suv: { product_id: 903, label: 'Parallélisme — SUV / 4x4', default_price: 150 },
      });
      comp.ngOnInit();

      comp.onParalToggle(true);

      expect(comp.paralOn()).toBe(true);
      expect(comp.paralType()).toBe('suv');
      expect(comp.formData.items!.some((i: any) => i.product_id === 903)).toBe(true);
    });

    it('treats a failed catalog load as fully unavailable rather than throwing', () => {
      prestationServiceStub.getCatalog = () => throwError(() => new Error('network'));

      expect(() => comp.ngOnInit()).not.toThrow();
      expect(comp.isMontageAvailable()).toBe(false);
      expect(comp.isParalAvailable()).toBe(false);
    });
  });
});
