import { ShipmentChangePrintComponent } from './shipment-change-print.component';
import { ShipmentChangeItem } from '../../models/shipment-change.model';

describe('ShipmentChangePrintComponent', () => {
  let comp: ShipmentChangePrintComponent;

  beforeEach(() => {
    comp = Object.create(ShipmentChangePrintComponent.prototype);
  });

  describe('fieldLabel', () => {
    it('returns the mapped French label for a known field', () => {
      const item: ShipmentChangeItem = { field: 'payment_method', old_value: 'Chèque', new_value: 'Virement' };
      expect(comp.fieldLabel(item)).toBe('Mode de paiement');
    });

    it('returns the custom_label for field=other when provided', () => {
      const item: ShipmentChangeItem = { field: 'other', custom_label: 'Étage de livraison', old_value: '1', new_value: '2' };
      expect(comp.fieldLabel(item)).toBe('Étage de livraison');
    });

    it('falls back to the generic "Autre" label for field=other without custom_label', () => {
      const item: ShipmentChangeItem = { field: 'other', old_value: '1', new_value: '2' };
      expect(comp.fieldLabel(item)).toBe('Autre');
    });
  });
});
