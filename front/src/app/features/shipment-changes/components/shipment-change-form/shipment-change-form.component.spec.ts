import { ShipmentChangeFormComponent } from './shipment-change-form.component';

function makeCarrierService() {
  return { getCarriers: () => ({ subscribe: () => {} }) };
}

describe('ShipmentChangeFormComponent', () => {
  let comp: ShipmentChangeFormComponent;

  beforeEach(() => {
    comp = new ShipmentChangeFormComponent(makeCarrierService() as any);
    comp.sale = {
      id: 1,
      linked_client: { name: 'Alice', phone: '0600000000', city: 'Casablanca' },
      total_sale: 600,
      payment_methods: ['Chèque', 'Virement'],
    } as any;
  });

  describe('addItem', () => {
    it('appends a new item defaulting to payment_method, prefilled from the sale', () => {
      comp.addItem();
      expect(comp.items().length).toBe(1);
      expect(comp.items()[0].field).toBe('payment_method');
      expect(comp.items()[0].old_value).toBe('Chèque, Virement');
      expect(comp.items()[0].new_value).toBe('');
    });
  });

  describe('removeItem', () => {
    it('removes the item at the given index', () => {
      comp.addItem();
      comp.addItem();
      comp.removeItem(0);
      expect(comp.items().length).toBe(1);
    });
  });

  describe('onFieldChange prefill', () => {
    beforeEach(() => comp.addItem());

    it('prefills recipient_name from linked_client.name', () => {
      comp.onFieldChange(0, 'recipient_name');
      expect(comp.items()[0].old_value).toBe('Alice');
    });

    it('prefills recipient_phone from linked_client.phone', () => {
      comp.onFieldChange(0, 'recipient_phone');
      expect(comp.items()[0].old_value).toBe('0600000000');
    });

    it('prefills city from linked_client.city', () => {
      comp.onFieldChange(0, 'city');
      expect(comp.items()[0].old_value).toBe('Casablanca');
    });

    it('prefills amount from sale.total_sale', () => {
      comp.onFieldChange(0, 'amount');
      expect(comp.items()[0].old_value).toBe('600');
    });

    it('clears custom_label and old_value for other', () => {
      comp.onFieldChange(0, 'other');
      expect(comp.items()[0].old_value).toBe('');
      expect(comp.items()[0].custom_label).toBeNull();
    });
  });

  describe('canSubmit', () => {
    it('is false when there are no items', () => {
      comp.items.set([]);
      expect(comp.canSubmit).toBe(false);
    });

    it('is false when any item is missing new_value', () => {
      comp.items.set([{ field: 'amount', old_value: '600', new_value: '' }]);
      expect(comp.canSubmit).toBe(false);
    });

    it('is true when date is set and every item has a new_value', () => {
      comp.items.set([{ field: 'amount', old_value: '600', new_value: '550' }]);
      expect(comp.canSubmit).toBe(true);
    });
  });
});
