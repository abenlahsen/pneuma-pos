import { ShipmentChangeListComponent } from './shipment-change-list.component';
import { ShipmentChangeRequest } from '../../models/shipment-change.model';

function makeRequest(overrides: Partial<ShipmentChangeRequest> = {}): ShipmentChangeRequest {
  return {
    id: 1,
    sale_id: 10,
    carrier_id: null,
    shipment_number: 'TRK-1',
    date: '2026-08-04',
    status: 'BROUILLON',
    sent_at: null,
    carrier_response: null,
    reason: null,
    items: [],
    ...overrides,
  };
}

describe('ShipmentChangeListComponent', () => {
  let comp: ShipmentChangeListComponent;

  beforeEach(() => {
    comp = new ShipmentChangeListComponent();
  });

  describe('statusClass', () => {
    it('maps ACCEPTEE to badge-success', () => {
      expect(comp.statusClass('ACCEPTEE')).toBe('badge-success');
    });

    it('maps REFUSEE to badge-danger', () => {
      expect(comp.statusClass('REFUSEE')).toBe('badge-danger');
    });

    it('maps ENVOYEE to badge-warning', () => {
      expect(comp.statusClass('ENVOYEE')).toBe('badge-warning');
    });

    it('maps BROUILLON to badge-neutral', () => {
      expect(comp.statusClass('BROUILLON')).toBe('badge-neutral');
    });
  });

  describe('isClosed', () => {
    it('is true for ACCEPTEE and REFUSEE', () => {
      expect(comp.isClosed(makeRequest({ status: 'ACCEPTEE' }))).toBe(true);
      expect(comp.isClosed(makeRequest({ status: 'REFUSEE' }))).toBe(true);
    });

    it('is false for BROUILLON and ENVOYEE', () => {
      expect(comp.isClosed(makeRequest({ status: 'BROUILLON' }))).toBe(false);
      expect(comp.isClosed(makeRequest({ status: 'ENVOYEE' }))).toBe(false);
    });
  });

  describe('onStatusSelect', () => {
    it('emits statusChange when the value differs from the current status', () => {
      const emitted: any[] = [];
      comp.statusChange.subscribe((e) => emitted.push(e));

      const request = makeRequest({ status: 'BROUILLON' });
      comp.onStatusSelect(request, 'ENVOYEE');

      expect(emitted).toEqual([{ request, status: 'ENVOYEE' }]);
    });

    it('does not emit when the value equals the current status', () => {
      const emitted: any[] = [];
      comp.statusChange.subscribe((e) => emitted.push(e));

      comp.onStatusSelect(makeRequest({ status: 'BROUILLON' }), 'BROUILLON');

      expect(emitted.length).toBe(0);
    });

    it('does not emit for an empty value', () => {
      const emitted: any[] = [];
      comp.statusChange.subscribe((e) => emitted.push(e));

      comp.onStatusSelect(makeRequest({ status: 'BROUILLON' }), '');

      expect(emitted.length).toBe(0);
    });
  });
});
