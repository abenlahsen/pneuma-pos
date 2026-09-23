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
      linked_client: {
        name: 'Alice',
        phone: '0600000000',
        city: 'Casablanca',
        address: '12 rue des Pneus',
      },
      total_sale: 600,
      payment_methods: ['Chèque', 'Virement'],
    } as any;
  });

  describe('addItem', () => {
    it('démarre sur l’adresse, le motif le plus courant, préremplie', () => {
      comp.addItem();
      expect(comp.items().length).toBe(1);
      expect(comp.items()[0].field).toBe('address');
      expect(comp.items()[0].old_value).toBe('12 rue des Pneus');
      expect(comp.items()[0].new_value).toBe('');
    });

    it('prend le premier champ libre, jamais celui d’une ligne existante', () => {
      comp.addItem();
      comp.addItem();
      comp.addItem();

      expect(comp.items().map(i => i.field)).toEqual([
        'address',
        'recipient_name',
        'recipient_phone',
      ]);
    });

    it('saute les champs déjà pris, même hors ordre', () => {
      comp.addItem();
      comp.onFieldChange(0, 'amount');
      comp.addItem();

      // `amount` est pris : la nouvelle ligne redescend sur l'adresse.
      expect(comp.items()[1].field).toBe('address');
    });

    it('retombe sur « autre » quand tous les champs sont pris', () => {
      // Six champs nommés, puis deux lignes de plus.
      for (let n = 0; n < 8; n++) comp.addItem();

      const champs = comp.items().map(i => i.field);
      expect(champs.slice(0, 6)).toEqual([
        'address', 'recipient_name', 'recipient_phone', 'city', 'amount', 'payment_method',
      ]);
      // `other` est le seul qui peut revenir.
      expect(champs.slice(6)).toEqual(['other', 'other']);
    });
  });

  describe('isFieldTaken', () => {
    beforeEach(() => {
      comp.addItem();          // address
      comp.addItem();          // recipient_name
    });

    it('grise un champ porté par une autre ligne', () => {
      expect(comp.isFieldTaken('recipient_name', 0)).toBe(true);
      expect(comp.isFieldTaken('address', 1)).toBe(true);
    });

    it('ne grise jamais une ligne contre elle-même', () => {
      expect(comp.isFieldTaken('address', 0)).toBe(false);
      expect(comp.isFieldTaken('recipient_name', 1)).toBe(false);
    });

    it('laisse « autre » disponible pour toutes les lignes', () => {
      comp.onFieldChange(0, 'other');
      expect(comp.isFieldTaken('other', 1)).toBe(false);
    });

    it('laisse libre un champ que personne n’a pris', () => {
      expect(comp.isFieldTaken('city', 0)).toBe(false);
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

    it('prefills address from linked_client.address', () => {
      comp.onFieldChange(0, 'address');
      expect(comp.items()[0].old_value).toBe('12 rue des Pneus');
    });

    it('laisse l’adresse vide quand le client n’en a pas, sans rien inventer', () => {
      comp.sale = { id: 1, linked_client: { name: 'Bob' } } as never;
      comp.onFieldChange(0, 'address');
      expect(comp.items()[0].old_value).toBe('');
    });

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

  describe('isOldValueLocked', () => {
    it('verrouille une valeur venue du préremplissage', () => {
      comp.addItem();
      expect(comp.items()[0].old_value).toBe('12 rue des Pneus');
      expect(comp.isOldValueLocked(comp.items()[0])).toBe(true);
    });

    it('laisse la main quand la source est vide côté vente', () => {
      comp.sale = { id: 1, linked_client: { name: 'Bob' } } as never;
      comp.addItem();

      // Bob n'a pas d'adresse : rien à constater, donc rien à verrouiller.
      expect(comp.items()[0].old_value).toBe('');
      expect(comp.isOldValueLocked(comp.items()[0])).toBe(false);
    });

    it('laisse toujours la main sur une ligne « Autre »', () => {
      comp.addItem();
      comp.onFieldChange(0, 'other');
      comp.setOldValue(0, 'Étage 2');

      expect(comp.isOldValueLocked(comp.items()[0])).toBe(false);
    });

    it('setOldValue écrit la valeur sans toucher au reste de la ligne', () => {
      comp.addItem();
      comp.onFieldChange(0, 'other');
      comp.setOldValue(0, 'Rez-de-chaussée');

      expect(comp.items()[0].old_value).toBe('Rez-de-chaussée');
      expect(comp.items()[0].field).toBe('other');
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
