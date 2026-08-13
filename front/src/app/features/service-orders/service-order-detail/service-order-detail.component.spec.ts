import { ServiceOrderDetailComponent } from './service-order-detail.component';

describe('ServiceOrderDetailComponent', () => {
  let comp: ServiceOrderDetailComponent;

  const baseOrder = (): any => ({
    id: 1,
    date: '2026-05-01',
    vehicle: 'Renault Clio',
    mileage: 50000,
    total_amount: 300,
    discount: 0,
    net_amount: 300,
    status: 'EN COURS',
    payment_status: 'NON PAYE',
    notes: null,
    items: [],
    client_record: null,
  });

  beforeEach(() => {
    comp = new ServiceOrderDetailComponent();
    comp.serviceOrder = baseOrder();
  });

  // -------------------------------------------------------------------------
  // clientName
  // -------------------------------------------------------------------------

  describe('clientName', () => {
    it('returns client_record.name when present', () => {
      comp.serviceOrder = { ...baseOrder(), client_record: { name: 'Garage Alpha', phone: null } };
      expect(comp.clientName).toBe('Garage Alpha');
    });

    it('trims whitespace from name', () => {
      comp.serviceOrder = { ...baseOrder(), client_record: { name: '  Beta  ', phone: null } };
      expect(comp.clientName).toBe('Beta');
    });

    it('returns em-dash when client_record is null', () => {
      comp.serviceOrder = { ...baseOrder(), client_record: null };
      expect(comp.clientName).toBe('—');
    });

    it('returns em-dash when name is empty string', () => {
      comp.serviceOrder = { ...baseOrder(), client_record: { name: '', phone: null } };
      expect(comp.clientName).toBe('—');
    });
  });

  // -------------------------------------------------------------------------
  // clientPhone
  // -------------------------------------------------------------------------

  describe('clientPhone', () => {
    it('returns client_record.phone when present', () => {
      comp.serviceOrder = { ...baseOrder(), client_record: { name: 'X', phone: '0612345678' } };
      expect(comp.clientPhone).toBe('0612345678');
    });

    it('trims whitespace from phone', () => {
      comp.serviceOrder = { ...baseOrder(), client_record: { name: 'X', phone: ' 0600000000 ' } };
      expect(comp.clientPhone).toBe('0600000000');
    });

    it('returns em-dash when phone is null', () => {
      comp.serviceOrder = { ...baseOrder(), client_record: { name: 'X', phone: null } };
      expect(comp.clientPhone).toBe('—');
    });

    it('returns em-dash when client_record is null', () => {
      comp.serviceOrder = { ...baseOrder(), client_record: null };
      expect(comp.clientPhone).toBe('—');
    });
  });

  // -------------------------------------------------------------------------
  // itemTotal
  // -------------------------------------------------------------------------

  describe('itemTotal', () => {
    it('uses line_total when present and non-null', () => {
      expect(comp.itemTotal({ line_total: 250, parts_cost: 100, labor_cost: 100 })).toBe(250);
    });

    it('falls back to parts_cost + labor_cost when line_total is null', () => {
      expect(comp.itemTotal({ line_total: null, parts_cost: 120, labor_cost: 80 })).toBe(200);
    });

    it('falls back to parts_cost + labor_cost when line_total is undefined', () => {
      expect(comp.itemTotal({ parts_cost: 50, labor_cost: 30 })).toBe(80);
    });

    it('handles missing costs as 0', () => {
      expect(comp.itemTotal({ line_total: null })).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // statusClass
  // -------------------------------------------------------------------------

  describe('statusClass', () => {
    it('returns badge-success for TERMINE', () => {
      expect(comp.statusClass('TERMINE')).toBe('badge-success');
    });

    it('returns badge-danger for ANNULE', () => {
      expect(comp.statusClass('ANNULE')).toBe('badge-danger');
    });

    it('returns badge-warning for EN COURS', () => {
      expect(comp.statusClass('EN COURS')).toBe('badge-warning');
    });

    it('returns badge-warning for any unknown status', () => {
      expect(comp.statusClass('INCONNU' as any)).toBe('badge-warning');
    });
  });

  // -------------------------------------------------------------------------
  // paymentClass
  // -------------------------------------------------------------------------

  describe('paymentClass', () => {
    it('returns badge-success for PAYE', () => {
      expect(comp.paymentClass('PAYE')).toBe('badge-success');
    });

    it('returns badge-warning for PARTIEL', () => {
      expect(comp.paymentClass('PARTIEL')).toBe('badge-warning');
    });

    it('returns badge-danger for NON PAYE', () => {
      expect(comp.paymentClass('NON PAYE')).toBe('badge-danger');
    });

    it('returns badge-danger for unknown status', () => {
      expect(comp.paymentClass('AUTRE' as any)).toBe('badge-danger');
    });
  });

  // -------------------------------------------------------------------------
  // close output
  // -------------------------------------------------------------------------

  describe('close event', () => {
    it('emits close event when triggered', () => {
      let count = 0;
      comp.close.subscribe(() => count++);
      comp.close.emit();
      expect(count).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // openPrint
  // -------------------------------------------------------------------------

  describe('openPrint', () => {
    it('sets printDoc signal with correct type and doc_number', () => {
      comp.serviceOrder = { ...baseOrder(), id: 42 };
      comp.openPrint();
      const doc = comp.printDoc();
      expect(doc).not.toBeNull();
      expect(doc!.type).toBe('service_order');
      expect(doc!.doc_number).toBe('42');
    });

    it('maps part items correctly', () => {
      comp.serviceOrder = {
        ...baseOrder(),
        items: [{ item_type: 'part', product_name: 'Filtre à huile', product_reference: 'REF-001', quantity: 2, unit_price: 50, line_total: 100 }],
      };
      comp.openPrint();
      const line = comp.printDoc()!.lines[0];
      expect(line.label).toBe('Filtre à huile');
      expect(line.qty).toBe(2);
      expect(line.total).toBe(100);
    });

    it('maps service items correctly', () => {
      comp.serviceOrder = {
        ...baseOrder(),
        items: [{ item_type: 'service', service_type: 'Vidange', labor_cost: 150, quantity: 1, line_total: 150 }],
      };
      comp.openPrint();
      const line = comp.printDoc()!.lines[0];
      expect(line.label).toBe('Vidange');
      expect(line.total).toBe(150);
    });
  });
});
