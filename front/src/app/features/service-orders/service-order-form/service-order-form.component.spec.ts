import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { of } from 'rxjs';

import { ServiceOrderFormComponent } from './service-order-form.component';
import { ClientService } from '../../clients/data-access/client.service';
import { ProductService } from '../../products/data-access/product.service';
import { ServiceOrderService } from '../data-access/service-order.service';

const clientServiceStub = {
  getClients: () => of([]),
};

const productServiceStub = {
  getProducts: () => of({ data: [], total: 0, current_page: 1, last_page: 1, per_page: 500 }),
};

const serviceOrderServiceStub = {
  searchParts: () => of([]),
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
        { provide: ServiceOrderService, useValue: serviceOrderServiceStub },
      ],
    }).compileComponents();

    comp = TestBed.createComponent(ServiceOrderFormComponent).componentInstance;
  });

  // -------------------------------------------------------------------------
  // totalAmount computed signal
  // -------------------------------------------------------------------------

  describe('totalAmount', () => {
    it('sums labor_cost × quantity for service lines', () => {
      comp.lines.set([
        { item_type: 'service', service_type: 'Vidange', description: '', quantity: 1, parts_cost: 0, labor_cost: 80 },
        { item_type: 'service', service_type: 'Freins', description: '', quantity: 1, parts_cost: 0, labor_cost: 150 },
      ]);
      expect(comp.totalAmount()).toBe(230);
    });

    it('handles string coercions from inputs', () => {
      comp.lines.set([
        { item_type: 'service', service_type: 'X', description: '', quantity: 1, parts_cost: 0, labor_cost: '100' as any },
      ]);
      expect(comp.totalAmount()).toBe(100);
    });

    it('returns 0 when lines array is empty', () => {
      comp.lines.set([]);
      expect(comp.totalAmount()).toBe(0);
    });

    it('multiplies labor_cost by quantity', () => {
      comp.lines.set([
        { item_type: 'service', service_type: 'X', description: '', quantity: 3, parts_cost: 0, labor_cost: 50 },
      ]);
      expect(comp.totalAmount()).toBe(150);
    });

    it('sums unit_price × quantity for part lines', () => {
      comp.lines.set([
        { item_type: 'part', product_id: 1, product_name: 'Filtre', product_reference: '', unit: 'pièce', quantity: 2, unit_price: 75, total_quantity: 10, searchQuery: '', searchResults: [], searching: false },
      ]);
      expect(comp.totalAmount()).toBe(150);
    });
  });

  // -------------------------------------------------------------------------
  // netAmount computed signal (percentage discount)
  // -------------------------------------------------------------------------

  describe('netAmount', () => {
    it('applies percentage discount to totalAmount', () => {
      comp.lines.set([{ item_type: 'service', service_type: 'X', description: '', quantity: 1, parts_cost: 0, labor_cost: 300 }]);
      comp.discount.set(10);
      expect(comp.netAmount()).toBe(270);
    });

    it('clamps to 0 when discount is 100%', () => {
      comp.lines.set([{ item_type: 'service', service_type: 'X', description: '', quantity: 1, parts_cost: 0, labor_cost: 100 }]);
      comp.discount.set(100);
      expect(comp.netAmount()).toBe(0);
    });

    it('equals totalAmount when discount is 0', () => {
      comp.lines.set([{ item_type: 'service', service_type: 'X', description: '', quantity: 1, parts_cost: 0, labor_cost: 200 }]);
      comp.discount.set(0);
      expect(comp.netAmount()).toBe(200);
    });

    it('handles 50% discount correctly', () => {
      comp.lines.set([{ item_type: 'service', service_type: 'X', description: '', quantity: 1, parts_cost: 0, labor_cost: 200 }]);
      comp.discount.set(50);
      expect(comp.netAmount()).toBe(100);
    });
  });

  // -------------------------------------------------------------------------
  // Lines management
  // -------------------------------------------------------------------------

  describe('addServiceLine', () => {
    it('appends a service line with defaults', () => {
      comp.lines.set([]);
      comp.addServiceLine();
      expect(comp.lines()).toHaveLength(1);
      expect(comp.lines()[0].item_type).toBe('service');
    });

    it('preserves existing lines when adding', () => {
      comp.lines.set([
        { item_type: 'service', service_type: 'A', description: '', quantity: 1, parts_cost: 0, labor_cost: 50 },
      ]);
      comp.addServiceLine();
      expect(comp.lines()).toHaveLength(2);
    });
  });

  describe('addPartLine', () => {
    it('appends a part line with defaults', () => {
      comp.lines.set([]);
      comp.addPartLine();
      expect(comp.lines()).toHaveLength(1);
      expect(comp.lines()[0].item_type).toBe('part');
    });
  });

  describe('removeLine', () => {
    it('removes the line at the given index', () => {
      comp.lines.set([
        { item_type: 'service', service_type: 'A', description: '', quantity: 1, parts_cost: 0, labor_cost: 50 },
        { item_type: 'service', service_type: 'B', description: '', quantity: 1, parts_cost: 0, labor_cost: 80 },
      ]);
      comp.removeLine(0);
      expect(comp.lines()).toHaveLength(1);
      expect((comp.lines()[0] as any).service_type).toBe('B');
    });

    it('does NOT remove when only one line remains', () => {
      comp.lines.set([
        { item_type: 'service', service_type: 'A', description: '', quantity: 1, parts_cost: 0, labor_cost: 50 },
      ]);
      comp.removeLine(0);
      expect(comp.lines()).toHaveLength(1);
    });
  });

  describe('updateLine', () => {
    it('patches the field at the given index without affecting other lines', () => {
      comp.lines.set([
        { item_type: 'service', service_type: 'X', description: '', quantity: 1, parts_cost: 0, labor_cost: 50 },
        { item_type: 'service', service_type: 'Y', description: '', quantity: 1, parts_cost: 0, labor_cost: 80 },
      ]);
      comp.updateLine(0, { labor_cost: 200 } as any);
      expect((comp.lines()[0] as any).labor_cost).toBe(200);
      expect((comp.lines()[1] as any).labor_cost).toBe(80);
    });
  });

  // -------------------------------------------------------------------------
  // serviceLineTotal / partLineTotal
  // -------------------------------------------------------------------------

  describe('serviceLineTotal', () => {
    it('returns quantity × labor_cost', () => {
      const line: any = { item_type: 'service', service_type: 'X', description: '', quantity: 3, parts_cost: 0, labor_cost: 50 };
      expect(comp.serviceLineTotal(line)).toBe(150);
    });

    it('defaults quantity to 1 when 0', () => {
      const line: any = { item_type: 'service', service_type: 'X', description: '', quantity: 0, parts_cost: 0, labor_cost: 100 };
      expect(comp.serviceLineTotal(line)).toBe(100);
    });
  });

  describe('partLineTotal', () => {
    it('returns quantity × unit_price', () => {
      const line: any = { item_type: 'part', product_id: 1, product_name: 'Filtre', quantity: 2, unit_price: 75 };
      expect(comp.partLineTotal(line)).toBe(150);
    });
  });

  // -------------------------------------------------------------------------
  // hasValidLines
  // -------------------------------------------------------------------------

  describe('hasValidLines', () => {
    it('returns true when a service line has a non-empty service_type', () => {
      comp.lines.set([{ item_type: 'service', service_type: 'Vidange', description: '', quantity: 1, parts_cost: 0, labor_cost: 0 }]);
      expect(comp.hasValidLines()).toBe(true);
    });

    it('returns false when service line has empty service_type', () => {
      comp.lines.set([{ item_type: 'service', service_type: '', description: '', quantity: 1, parts_cost: 0, labor_cost: 0 }]);
      expect(comp.hasValidLines()).toBe(false);
    });

    it('returns true when a part line has a product_id', () => {
      comp.lines.set([{
        item_type: 'part', product_id: 5, product_name: 'Filtre', product_reference: '',
        unit: 'pièce', quantity: 1, unit_price: 0, total_quantity: 10,
        searchQuery: '', searchResults: [], searching: false,
      }]);
      expect(comp.hasValidLines()).toBe(true);
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
    it('pre-fills signals and lines from a serviceOrder with service items', () => {
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
        items: [{
          item_type: 'service',
          service_type: 'Vidange',
          description: 'Huile synthétique',
          quantity: 1,
          parts_cost: 0,
          labor_cost: 150,
          line_total: 150,
          sort_order: 0,
        }],
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
      expect(comp.lines()).toHaveLength(1);
      expect((comp.lines()[0] as any).labor_cost).toBe(150);
      expect((comp.lines()[0] as any).description).toBe('Huile synthétique');
    });

    it('starts with a single default service line when no serviceOrder', () => {
      comp.ngOnInit();
      expect(comp.lines()).toHaveLength(1);
      expect(comp.lines()[0].item_type).toBe('service');
    });
  });

  // -------------------------------------------------------------------------
  // onSubmit — payload emission
  // -------------------------------------------------------------------------

  describe('onSubmit', () => {
    it('emits the correct ServiceOrderPayload for a service line', () => {
      comp.date.set('2026-05-15');
      comp.vehicle.set('Renault Clio');
      comp.mileage.set(45000);
      comp.discount.set(10);
      comp.status.set('EN COURS');
      comp.notes.set('RAS');
      comp.commercial_id.set(3);
      comp.client_id.set(null);
      comp.lines.set([
        { item_type: 'service', service_type: 'Vidange', description: 'Huile 5W30', quantity: 1, parts_cost: 0, labor_cost: 120 },
      ]);

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
      expect(emitted[0].items[0].item_type).toBe('service');
      expect(emitted[0].items[0].labor_cost).toBe(120);
      expect(emitted[0].items[0].description).toBe('Huile 5W30');
      expect(emitted[0].items[0].sort_order).toBe(0);
    });

    it('converts empty notes to null', () => {
      comp.notes.set('');
      comp.lines.set([{ item_type: 'service', service_type: 'X', description: '', quantity: 1, parts_cost: 0, labor_cost: 50 }]);
      const emitted: any[] = [];
      comp.save.subscribe((p) => emitted.push(p));
      comp.onSubmit();
      expect(emitted[0].notes).toBeNull();
    });

    it('converts empty item description to null for service lines', () => {
      comp.lines.set([{ item_type: 'service', service_type: 'X', description: '', quantity: 1, parts_cost: 0, labor_cost: 50 }]);
      const emitted: any[] = [];
      comp.save.subscribe((p) => emitted.push(p));
      comp.onSubmit();
      expect(emitted[0].items[0].description).toBeNull();
    });

    it('emits multiple items when multiple lines are set', () => {
      comp.lines.set([
        { item_type: 'service', service_type: 'A', description: '', quantity: 1, parts_cost: 0, labor_cost: 80 },
        { item_type: 'service', service_type: 'B', description: 'Details', quantity: 1, parts_cost: 0, labor_cost: 150 },
      ]);
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
  // Client filtering
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
      comp.onClientSearchInput('zzzznosuchclient');
      expect(comp.filteredClients()).toHaveLength(0);
    });
  });
});
