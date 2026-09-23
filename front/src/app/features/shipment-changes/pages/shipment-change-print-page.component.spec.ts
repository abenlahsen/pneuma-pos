import { ShipmentChangePrintPageComponent } from './shipment-change-print-page.component';
import { ShipmentChangeItem, ShipmentChangeRequest } from '../models/shipment-change.model';

function makeRequest(overrides: Partial<ShipmentChangeRequest> = {}): ShipmentChangeRequest {
  return {
    id: 142,
    sale_id: 4251,
    sale: {
      id: 4251,
      date: '2026-09-16',
      client: 'Garage Atlas Pneus',
      tracking_number: 'RL-88412093',
      total_sale: '8400.00',
      total_quantity: 4,
    },
    carrier_id: 3,
    carrier: { id: 3, name: 'Rapide Log', phone: '0522 44 18 30', email: 'modif@rapidelog.ma' },
    shipment_number: 'RL-88412093',
    date: '2026-09-17',
    status: 'ENVOYEE' as ShipmentChangeRequest['status'],
    sent_at: null,
    carrier_response: null,
    reason: 'Livraison sur le second dépôt.',
    items: [],
    creator: { id: 7, name: 'Y. Benali', role: 'Manager' },
    ...overrides,
  };
}

describe('ShipmentChangePrintPageComponent', () => {
  let comp: ShipmentChangePrintPageComponent;

  beforeEach(() => {
    comp = Object.create(ShipmentChangePrintPageComponent.prototype);
    // Les deux signaux que les computeds lisent, posés à la main : le composant
    // n'est pas instancié par Angular ici, on teste sa logique de rendu.
    Object.assign(comp, {
      request: () => makeRequest(),
      settings: () => ({ city: 'Casablanca' }),
    });
  });

  // ── Les libellés, repris de l'ancien composant ─────────────────────────────

  describe('fieldLabel', () => {
    it('rend le libellé français d’un champ connu', () => {
      const item: ShipmentChangeItem = { field: 'payment_method', old_value: 'Chèque', new_value: 'Virement' };
      expect(comp.fieldLabel(item)).toBe('Mode de paiement');
    });

    it('rend le libellé libre quand field vaut other', () => {
      const item: ShipmentChangeItem = {
        field: 'other',
        custom_label: 'Étage de livraison',
        old_value: '1',
        new_value: '2',
      };
      expect(comp.fieldLabel(item)).toBe('Étage de livraison');
    });

    it('retombe sur « Autre » quand le libellé libre manque', () => {
      const item: ShipmentChangeItem = { field: 'other', old_value: '1', new_value: '2' };
      expect(comp.fieldLabel(item)).toBe('Autre');
    });
  });

  // ── Les deux champs que 18c ajoute ─────────────────────────────────────────

  describe('champs ajoutés par 18c', () => {
    it('annonce le nombre de colis depuis la quantité de la vente', () => {
      expect(comp.parcelCount()).toBe(4);
    });

    it('n’invente pas de nombre de colis quand la vente ne le porte pas', () => {
      Object.assign(comp, { request: () => makeRequest({ sale: null }) });
      expect(comp.parcelCount()).toBeNull();
    });

    it('nomme le signataire avec sa fonction', () => {
      expect(comp.signatory()).toBe('Y. Benali · manager');
    });

    it('se contente du nom quand le rôle manque', () => {
      Object.assign(comp, {
        request: () => makeRequest({ creator: { id: 7, name: 'Y. Benali', role: null } }),
      });
      expect(comp.signatory()).toBe('Y. Benali');
    });

    it('n’affiche pas de signataire quand la demande n’a pas d’auteur', () => {
      Object.assign(comp, { request: () => makeRequest({ creator: null }) });
      expect(comp.signatory()).toBeNull();
    });
  });

  // ── En-tête ────────────────────────────────────────────────────────────────

  describe('en-tête', () => {
    it('compose la référence à partir de l’année et de l’identifiant', () => {
      expect(comp.reference(makeRequest())).toBe('DM-2026-0142');
    });

    it('écrit le lieu et la date de la lettre', () => {
      expect(comp.placeAndDate(makeRequest())).toBe('Casablanca, le 17/09/2026');
    });

    it('se passe du lieu quand les paramètres ne le donnent pas', () => {
      Object.assign(comp, { settings: () => ({ city: null }) });
      expect(comp.placeAndDate(makeRequest())).toBe('Le 17/09/2026');
    });

    it('rend une date absente par un tiret, jamais par une date inventée', () => {
      expect(comp.fmtDate(null)).toBe('—');
      expect(comp.fmtDate('2026-09-16')).toBe('16/09/2026');
    });
  });
});
