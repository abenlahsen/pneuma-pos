import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { of } from 'rxjs';

import { ServiceOrderFormComponent } from './service-order-form.component';
import { ClientService } from '../../clients/data-access/client.service';
import { ProductService } from '../../products/data-access/product.service';

const clientServiceStub = {
  getClients: () => of([]),
};

const productServiceStub = {
  getProducts: () => of({ data: [], total: 0, current_page: 1, last_page: 1, per_page: 500 }),
};

describe('ServiceOrderFormComponent', () => {
  let comp: ServiceOrderFormComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ServiceOrderFormComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: ClientService, useValue: clientServiceStub },
        { provide: ProductService, useValue: productServiceStub },
      ],
    }).compileComponents();

    comp = TestBed.createComponent(ServiceOrderFormComponent).componentInstance;
  });

  // -------------------------------------------------------------------------
  // totalAmount computed signal
  // -------------------------------------------------------------------------

  describe('totalAmount', () => {
    it('sums prices of all checked services', () => {
      comp.checkedServices.set({
        1: { price: 80, description: '' },
        2: { price: 150, description: '' },
      });
      expect(comp.totalAmount()).toBe(230);
    });

    it('handles string coercions from inputs', () => {
      comp.checkedServices.set({ 1: { price: '100' as any, description: '' } });
      expect(comp.totalAmount()).toBe(100);
    });

    it('returns 0 when no services checked', () => {
      comp.checkedServices.set({});
      expect(comp.totalAmount()).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // netAmount computed signal (percentage discount)
  // -------------------------------------------------------------------------

  describe('netAmount', () => {
    it('applies percentage discount to totalAmount', () => {
      comp.checkedServices.set({ 1: { price: 300, description: '' } });
      comp.discount.set(10); // 10%
      expect(comp.netAmount()).toBe(270);
    });

    it('clamps to 0 when discount is 100%', () => {
      comp.checkedServices.set({ 1: { price: 100, description: '' } });
      comp.discount.set(100);
      expect(comp.netAmount()).toBe(0);
    });

    it('equals totalAmount when discount is 0', () => {
      comp.checkedServices.set({ 1: { price: 200, description: '' } });
      comp.discount.set(0);
      expect(comp.netAmount()).toBe(200);
    });

    it('handles 50% discount correctly', () => {
      comp.checkedServices.set({ 1: { price: 200, description: '' } });
      comp.discount.set(50);
      expect(comp.netAmount()).toBe(100);
    });
  });

  // -------------------------------------------------------------------------
  // checkedCount computed signal
  // -------------------------------------------------------------------------

  describe('checkedCount', () => {
    it('returns the number of checked services', () => {
      comp.checkedServices.set({
        1: { price: 50, description: '' },
        2: { price: 80, description: '' },
      });
      expect(comp.checkedCount()).toBe(2);
    });

    it('returns 0 when nothing is checked', () => {
      comp.checkedServices.set({});
      expect(comp.checkedCount()).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // toggleProduct
  // -------------------------------------------------------------------------

  describe('toggleProduct', () => {
    it('adds a service when unchecked, pre-filling selling_price', () => {
      comp.serviceProducts.set([
        { id: 5, profile: 'Vidange', reference: null, selling_price: 120 },
      ]);
      comp.checkedServices.set({});
      comp.toggleProduct(5);
      expect(comp.isChecked(5)).toBe(true);
      expect(comp.getCheckedEntry(5).price).toBe(120);
      expect(comp.getCheckedEntry(5).description).toBe('');
    });

    it('removes a service when already checked', () => {
      comp.checkedServices.set({ 5: { price: 100, description: '' } });
      comp.toggleProduct(5);
      expect(comp.isChecked(5)).toBe(false);
    });

    it('pre-fills price with 0 when product has no selling_price', () => {
      comp.serviceProducts.set([
        { id: 3, profile: 'Révision', reference: null, selling_price: null },
      ]);
      comp.toggleProduct(3);
      expect(comp.getCheckedEntry(3).price).toBe(0);
    });

    it('does not affect other checked services when removing one', () => {
      comp.checkedServices.set({
        1: { price: 50, description: '' },
        2: { price: 80, description: '' },
      });
      comp.toggleProduct(1);
      expect(comp.isChecked(1)).toBe(false);
      expect(comp.isChecked(2)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // isChecked
  // -------------------------------------------------------------------------

  describe('isChecked', () => {
    it('returns true for a checked product', () => {
      comp.checkedServices.set({ 7: { price: 100, description: '' } });
      expect(comp.isChecked(7)).toBe(true);
    });

    it('returns false for an unchecked product', () => {
      comp.checkedServices.set({});
      expect(comp.isChecked(7)).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // setPrice / setDescription
  // -------------------------------------------------------------------------

  describe('setPrice', () => {
    it('updates the price of a checked service', () => {
      comp.checkedServices.set({ 1: { price: 50, description: '' } });
      comp.setPrice(1, 200);
      expect(comp.getCheckedEntry(1).price).toBe(200);
    });

    it('does not affect description', () => {
      comp.checkedServices.set({ 1: { price: 50, description: 'test' } });
      comp.setPrice(1, 75);
      expect(comp.getCheckedEntry(1).description).toBe('test');
    });
  });

  describe('setDescription', () => {
    it('updates the description of a checked service', () => {
      comp.checkedServices.set({ 1: { price: 50, description: '' } });
      comp.setDescription(1, 'Huile 5W30');
      expect(comp.getCheckedEntry(1).description).toBe('Huile 5W30');
    });

    it('does not affect price', () => {
      comp.checkedServices.set({ 1: { price: 120, description: '' } });
      comp.setDescription(1, 'Test');
      expect(comp.getCheckedEntry(1).price).toBe(120);
    });
  });

  // -------------------------------------------------------------------------
  // Client search
  // -------------------------------------------------------------------------

  describe('onClientSearchInput', () => {
    it('updates clientSearch signal and shows suggestions', () => {
      comp.onClientSearchInput('renault');
      expect(comp.clientSearch()).toBe('renault');
      expect(comp.showClientSuggestions()).toBe(true);
    });
  });

  describe('selectClient', () => {
    it('sets selectedClient, client_id, and search text; hides suggestions', () => {
      const fakeClient = { id: 7, name: 'Garage Dupont', phone: '0600000000' } as any;
      comp.selectClient(fakeClient);
      expect(comp.selectedClient()).toEqual(fakeClient);
      expect(comp.client_id()).toBe(7);
      expect(comp.clientSearch()).toBe('Garage Dupont');
      expect(comp.showClientSuggestions()).toBe(false);
    });
  });

  describe('clearSelectedClient', () => {
    it('resets client selection signals', () => {
      const fakeClient = { id: 3, name: 'Alice', phone: '' } as any;
      comp.selectClient(fakeClient);
      comp.clearSelectedClient();
      expect(comp.selectedClient()).toBeNull();
      expect(comp.client_id()).toBeNull();
      expect(comp.clientSearch()).toBe('');
      expect(comp.showClientSuggestions()).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // ngOnInit — load from existing serviceOrder
  // -------------------------------------------------------------------------

  describe('ngOnInit', () => {
    it('pre-fills signals and checkedServices from an existing serviceOrder', () => {
      comp.serviceOrder = {
        id: 10,
        date: '2026-05-01',
        vehicle: 'Peugeot 308',
        mileage: 80000,
        discount: 10,
        status: 'TERMINE',
        notes: 'Bon client',
        commercial_id: 2,
        client_id: 5,
        client_record: { name: 'Alpha Garage', phone: '0611111111' },
        items: [
          { product_id: 7, description: 'Huile synthétique', parts_cost: 50, labor_cost: 100, line_total: 150, sort_order: 0 },
        ],
      } as any;

      comp.ngOnInit();

      expect(comp.vehicle()).toBe('Peugeot 308');
      expect(comp.mileage()).toBe(80000);
      expect(comp.discount()).toBe(10);
      expect(comp.status()).toBe('TERMINE');
      expect(comp.notes()).toBe('Bon client');
      expect(comp.commercial_id()).toBe(2);
      expect(comp.client_id()).toBe(5);
      expect(comp.clientSearch()).toBe('Alpha Garage');
      expect(comp.isChecked(7)).toBe(true);
      expect(comp.getCheckedEntry(7).price).toBe(150);
      expect(comp.getCheckedEntry(7).description).toBe('Huile synthétique');
    });

    it('starts with empty checkedServices when no serviceOrder', () => {
      comp.ngOnInit();
      expect(comp.checkedCount()).toBe(0);
    });

    it('ignores items without a product_id', () => {
      comp.serviceOrder = {
        id: 11,
        date: '2026-05-01',
        vehicle: 'Ford',
        mileage: null,
        discount: 0,
        status: 'EN COURS',
        notes: null,
        commercial_id: null,
        client_id: null,
        client_record: null,
        items: [
          { product_id: null, description: null, parts_cost: 50, labor_cost: 0, line_total: 50, sort_order: 0 },
        ],
      } as any;

      comp.ngOnInit();
      expect(comp.checkedCount()).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // onSubmit — payload emission
  // -------------------------------------------------------------------------

  describe('onSubmit', () => {
    it('emits the correct ServiceOrderPayload', () => {
      comp.date.set('2026-05-15');
      comp.vehicle.set('Renault Clio');
      comp.mileage.set(45000);
      comp.discount.set(10);
      comp.status.set('EN COURS');
      comp.notes.set('RAS');
      comp.commercial_id.set(3);
      comp.client_id.set(null);
      comp.checkedServices.set({ 5: { price: 120, description: 'Huile 5W30' } });

      const emitted: any[] = [];
      comp.save.subscribe((p) => emitted.push(p));
      comp.onSubmit();

      expect(emitted).toHaveLength(1);
      expect(emitted[0].vehicle).toBe('Renault Clio');
      expect(emitted[0].mileage).toBe(45000);
      expect(emitted[0].discount).toBe(10);
      expect(emitted[0].status).toBe('EN COURS');
      expect(emitted[0].notes).toBe('RAS');
      expect(emitted[0].commercial_id).toBe(3);
      expect(emitted[0].client_id).toBeNull();
      expect(emitted[0].items).toHaveLength(1);
      expect(emitted[0].items[0].product_id).toBe(5);
      expect(emitted[0].items[0].labor_cost).toBe(120);
      expect(emitted[0].items[0].parts_cost).toBe(0);
      expect(emitted[0].items[0].description).toBe('Huile 5W30');
      expect(emitted[0].items[0].sort_order).toBe(0);
    });

    it('converts empty notes to null', () => {
      comp.notes.set('');
      comp.checkedServices.set({ 1: { price: 50, description: '' } });

      const emitted: any[] = [];
      comp.save.subscribe((p) => emitted.push(p));
      comp.onSubmit();

      expect(emitted[0].notes).toBeNull();
    });

    it('converts empty item description to null', () => {
      comp.checkedServices.set({ 5: { price: 50, description: '' } });

      const emitted: any[] = [];
      comp.save.subscribe((p) => emitted.push(p));
      comp.onSubmit();

      expect(emitted[0].items[0].description).toBeNull();
    });

    it('emits multiple items when multiple services are checked', () => {
      comp.checkedServices.set({
        1: { price: 80, description: '' },
        2: { price: 150, description: 'Details' },
      });

      const emitted: any[] = [];
      comp.save.subscribe((p) => emitted.push(p));
      comp.onSubmit();

      expect(emitted[0].items).toHaveLength(2);
    });
  });

  // -------------------------------------------------------------------------
  // onCancel
  // -------------------------------------------------------------------------

  describe('onCancel', () => {
    it('emits cancel event', () => {
      let count = 0;
      comp.cancel.subscribe(() => count++);
      comp.onCancel();
      expect(count).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // isEditing getter
  // -------------------------------------------------------------------------

  describe('isEditing', () => {
    it('returns false when no serviceOrder', () => {
      comp.serviceOrder = null;
      expect(comp.isEditing).toBe(false);
    });

    it('returns true when serviceOrder is set', () => {
      comp.serviceOrder = { id: 1 } as any;
      expect(comp.isEditing).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Client filtering (syncClientSearchResults via onClientSearchInput)
  // -------------------------------------------------------------------------

  describe('client filtering', () => {
    beforeEach(() => {
      comp.clients.set([
        { id: 1, name: 'Garage Alpha', phone: '0600000001', city: 'Paris' } as any,
        { id: 2, name: 'Atelier Beta', phone: '0600000002', city: 'Lyon' } as any,
        { id: 3, name: 'Mécanique Gamma', phone: '0600000003', city: 'Marseille' } as any,
      ]);
    });

    it('shows up to 8 clients when search is empty', () => {
      comp.onClientSearchInput('');
      expect(comp.filteredClients().length).toBeLessThanOrEqual(8);
    });

    it('filters clients by name', () => {
      comp.onClientSearchInput('alpha');
      expect(comp.filteredClients()).toHaveLength(1);
      expect(comp.filteredClients()[0].name).toBe('Garage Alpha');
    });

    it('filters clients by city', () => {
      comp.onClientSearchInput('lyon');
      expect(comp.filteredClients()[0].name).toBe('Atelier Beta');
    });

    it('returns empty array when no match', () => {
      comp.onClientSearchInput('zzzznotsuchclient');
      expect(comp.filteredClients()).toHaveLength(0);
    });
  });
});
