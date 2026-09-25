import {
  buildPurchasePrint,
  buildSalePrint,
  buildServiceOrderPrint,
  saleLineTotal,
  signatoryOf,
} from './print-builders';

const tyre = (over: any = {}) => ({
  type: 'tyre',
  reference: 'REF-100',
  profile: 'Primacy 4',
  brand: { name: 'Michelin' },
  tyre: { tire_width: 205, tire_height: 55, tire_diameter: 16, tire_load_index: '91', tire_speed_index: 'V' },
  ...over,
});

describe('print-builders', () => {
  describe('signatoryOf', () => {
    it('signe « nom · fonction », la fonction en français', () => {
      expect(signatoryOf({ name: 'K. Amrani', role: 'Commercial' })).toBe('K. Amrani · commercial');
      expect(signatoryOf({ name: 'A. Benali', role: 'Administrator' })).toBe('A. Benali · administrateur');
    });

    it('se contente du nom sans rôle, et de rien sans nom', () => {
      expect(signatoryOf({ name: 'K. Amrani' })).toBe('K. Amrani');
      expect(signatoryOf(null)).toBeNull();
    });
  });

  // ── Vente ──────────────────────────────────────────────────────────────
  describe('buildSalePrint', () => {
    const sale = (over: any = {}): any => ({
      id: 4182,
      date: '2026-07-02',
      with_invoice: true,
      total_sale: '17556.48',
      paid_amount: '2360.00',
      items: [],
      ...over,
    });

    it('imprime une vente avec facture en FACTURE, TVA comprise', () => {
      const doc = buildSalePrint(sale());
      expect(doc.type).toBe('sale');
      expect(doc.title).toBe('Facture');
      expect(doc.doc_number).toBe('N° 4182');
      expect(doc.vat_applies).toBe(true);
      expect(doc.amount_in_words_intro).toBe('Arrêtée la présente facture');
      expect(doc.headline_label).toBe('Net à payer');
      expect(doc.receipt_box_title).toBe('Reçu par le client');
    });

    it('imprime une vente sans facture en BON DE VENTE, sans TVA', () => {
      const doc = buildSalePrint(sale({ with_invoice: false }));
      expect(doc.title).toBe('Bon de vente');
      expect(doc.vat_applies).toBe(false);
      expect(doc.amount_in_words_intro).toBe('Arrêté le présent bon de vente');
    });

    it('prend le net et le payé (allocations) de la vente', () => {
      const doc = buildSalePrint(sale());
      expect(doc.totals.net).toBe(17556.48);
      expect(doc.totals.paid).toBe(2360);
    });

    it('retombe sur la somme des paiements quand paid_amount est absent', () => {
      const doc = buildSalePrint(sale({ paid_amount: undefined, payments: [{ amount: '100' }, { amount: 50 }] }));
      expect(doc.totals.paid).toBe(150);
    });

    it('n’invente aucune remise globale : la remise est portée par les lignes, comptée une seule fois', () => {
      const doc = buildSalePrint(sale({
        total_sale: 180,
        items: [{ product_name: 'X', quantity: 2, selling_price: 100, discount: 10, total: 180 }],
      }));
      expect(doc.totals.discount_global).toBeUndefined();
      expect(doc.totals.lines_total).toBe(180);
      expect(doc.lines[0].discount).toBe(10);
      expect(doc.lines[0].total).toBe(180);
    });

    it('met la dimension, les indices et le DOT en sous-ligne sous la désignation', () => {
      const doc = buildSalePrint(sale({
        items: [{ linkedProduct: tyre(), stock: { dot: '2425' }, quantity: 8, selling_price: 1180, discount: 8 }],
      }));
      expect(doc.lines[0].label).toBe('Michelin Primacy 4');
      expect(doc.lines[0].details).toBe('205/55R16 91V · DOT 2425');
      expect(doc.lines[0].total).toBe(8684.8);
    });

    it('sous-titre une prestation « Prestation »', () => {
      const doc = buildSalePrint(sale({
        items: [{ linkedProduct: { type: 'service', reference: 'Montage et équilibrage' }, quantity: 12, selling_price: 60, total: 720 }],
      }));
      expect(doc.lines[0].label).toBe('Montage et équilibrage');
      expect(doc.lines[0].details).toBe('Prestation');
    });

    it('garde les replis de désignation : product_name, puis Produit #id', () => {
      expect(buildSalePrint(sale({ items: [{ product_name: 'Pneu 205/55R16', product_id: 3, quantity: 1, total: 100 }] })).lines[0].label)
        .toBe('Pneu 205/55R16');
      expect(buildSalePrint(sale({ items: [{ product_id: 9, quantity: 1, total: 50 }] })).lines[0].label)
        .toBe('Produit #9');
    });

    it('donne l’adresse et la ville puis le téléphone du client, sans ICE (le modèle n’en a pas)', () => {
      const doc = buildSalePrint(sale({
        linked_client: { name: 'Garage Atlas Pneus', address: 'Km 8, route de Rabat', city: 'Casablanca', phone: '0661 24 88 03' },
      }));
      expect(doc.party).toEqual({
        label: 'Client',
        name: 'Garage Atlas Pneus',
        lines: ['Km 8, route de Rabat, Casablanca', '0661 24 88 03'],
        ice: null,
      });
    });

    it('ne répète pas la ville déjà contenue dans l’adresse', () => {
      const doc = buildSalePrint(sale({ linked_client: { name: 'X', address: '12 rue des Pneus, Casablanca', city: 'Casablanca' } }));
      expect(doc.party.lines).toEqual(['12 rue des Pneus, Casablanca']);
    });

    it('range transport et paiement dans les cases, le n° de suivi en chasse fixe', () => {
      const doc = buildSalePrint(sale({
        carrier: { name: 'Rapide Log' }, tracking_number: 'RL-88412093',
        delivery_date: '2026-07-04', payment_methods: ['Espèces', 'Chèque'],
      }));
      expect(doc.info).toEqual([
        { label: 'Transporteur', value: 'Rapide Log' },
        { label: 'N° de suivi', value: 'RL-88412093', mono: true },
        { label: 'Livraison', value: '04/07/2026' },
        { label: 'Paiement', value: 'Espèces, Chèque' },
      ]);
    });

    it('signe au nom du commercial, avec sa fonction', () => {
      const doc = buildSalePrint(sale({ commercial: { id: 1, name: 'K. Amrani', role: 'Commercial' } }));
      expect(doc.signatory).toBe('K. Amrani · commercial');
    });
  });

  describe('saleLineTotal', () => {
    it('prend item.total quand il est présent, sinon prix × qté × (1 − remise)', () => {
      expect(saleLineTotal({ total: 150, selling_price: 999, quantity: 1 } as any)).toBe(150);
      expect(saleLineTotal({ total: null, selling_price: 100, quantity: 3, discount: 10 } as any)).toBe(270);
    });
  });

  // ── Achat ──────────────────────────────────────────────────────────────
  describe('buildPurchasePrint', () => {
    const purchase = (over: any = {}): any => ({
      id: 88,
      date: '2026-06-10',
      total_price: '1000.00',
      discount: '0.00',
      net_amount: '1000.00',
      items: [],
      supplier: { name: 'Fournisseur SA', address: 'Zone industrielle, Tanger', phone: '0539 00 00 00', email: 'contact@fsa.ma' },
      ...over,
    });

    it('fait du fournisseur le tiers, avec son adresse et son contact', () => {
      const doc = buildPurchasePrint(purchase());
      expect(doc.type).toBe('purchase');
      expect(doc.title).toBe("Bon d'achat");
      expect(doc.party).toEqual({
        label: 'Fournisseur',
        name: 'Fournisseur SA',
        lines: ['Zone industrielle, Tanger', '0539 00 00 00 · contact@fsa.ma'],
        ice: null,
      });
    });

    it('titre le cadre « Total dû au fournisseur » et remplace « Reçu par le client » par « Réceptionné par »', () => {
      const doc = buildPurchasePrint(purchase());
      expect(doc.headline_label).toBe('Total dû au fournisseur');
      expect(doc.receipt_box_title).toBe('Réceptionné par');
      expect(doc.vat_applies).toBe(false);
      expect(doc.amount_in_words_intro).toBe("Arrêté le présent bon d'achat");
    });

    it('interdit la colonne Remise', () => {
      const doc = buildPurchasePrint(purchase({
        items: [{ linkedProduct: tyre(), product_id: 5, quantity: 2, unit_price: 100 }],
      }));
      expect(doc.allow_discount_column).toBe(false);
      expect(doc.lines[0].discount).toBeUndefined();
      expect(doc.lines[0].total).toBe(200);
      expect(doc.lines[0].details).toBe('205/55R16 91V');
    });

    it('convertit la remise globale, un pourcentage, en dirhams', () => {
      // 5 % sur 1 000 : 50 DH — et non « 5,00 DH ».
      const doc = buildPurchasePrint(purchase({ discount: '5.00', net_amount: '950.00' }));
      expect(doc.totals.discount_global).toBe(50);
      expect(doc.totals.net).toBe(950);
    });

    it('déduit les retours et prend le payé net de show', () => {
      const doc = buildPurchasePrint(purchase({
        effective_net_amount: 700, paid_amount: 900,
        payments: [{ amount: 1000 }],
      }));
      expect(doc.totals.returns).toBe(300);
      expect(doc.totals.net).toBe(700);
      expect(doc.totals.paid).toBe(900);
    });

    it('met le BL et la facture fournisseur dans la ligne de référence', () => {
      const doc = buildPurchasePrint(purchase({ bl_number: 'BL-12', invoice_number: 'F-99' }));
      expect(doc.reference_note).toBe('BL n° BL-12 · facture fournisseur n° F-99');
    });

    it('imprime les modes de paiement', () => {
      const doc = buildPurchasePrint(purchase({ payment_methods: ['Virement', 'Effet'] }));
      expect(doc.info).toEqual([{ label: 'Paiement', value: 'Virement, Effet' }]);
    });

    it('garde les replis : « — » sans fournisseur, Produit #id sans produit', () => {
      const doc = buildPurchasePrint(purchase({ supplier: null, items: [{ product_id: 7, quantity: 1, unit_price: 50 }] }));
      expect(doc.party.name).toBe('—');
      expect(doc.lines[0].label).toBe('Produit #7');
    });
  });

  // ── Intervention ───────────────────────────────────────────────────────
  describe('buildServiceOrderPrint', () => {
    const order = (over: any = {}): any => ({
      id: 42,
      date: '2026-05-01',
      vehicle: 'Renault Clio',
      mileage: 50000,
      total_amount: '300.00',
      discount: '0.00',
      net_amount: '300.00',
      total_paid: 100,
      items: [],
      client_record: { name: 'Karim', phone: '0600', address: null, city: 'Rabat' },
      ...over,
    });

    it('imprime une fiche d’intervention, sans TVA ni colonne Remise', () => {
      const doc = buildServiceOrderPrint(order());
      expect(doc.type).toBe('service_order');
      expect(doc.title).toBe("Fiche d'intervention");
      expect(doc.doc_number).toBe('N° 42');
      expect(doc.vat_applies).toBe(false);
      expect(doc.allow_discount_column).toBe(false);
      expect(doc.totals.paid).toBe(100);
      expect(doc.party.lines).toEqual(['Rabat', '0600']);
    });

    it('met prestations et pièces dans le même tableau, avec leur sous-ligne', () => {
      const doc = buildServiceOrderPrint(order({
        items: [
          { item_type: 'service', service_type: 'Vidange', labor_cost: 150, quantity: 1, line_total: 150 },
          { item_type: 'part', product_name: 'Filtre à huile', product_reference: 'REF-001', quantity: 2, unit_price: 50, line_total: 100 },
        ],
      }));
      expect(doc.lines).toEqual([
        { label: 'Vidange', details: 'Prestation', qty: 1, unit_price: 150, total: 150 },
        { label: 'Filtre à huile', details: 'Pièce · REF-001', qty: 2, unit_price: 50, total: 100 },
      ]);
    });

    it('place le véhicule, sa plaque et le kilométrage sous le client', () => {
      const doc = buildServiceOrderPrint(order({
        vehicle_data: { id: 1, plate: '12345-A-6', brand: 'Dacia', model_name: 'Logan', circulation_month: 1, circulation_year: 2020 },
      }));
      expect(doc.vehicle).toEqual({ description: 'Dacia Logan', plate: '12345-A-6', mileage: 50000 });
    });

    it('retombe sur le libellé libre du véhicule quand il n’est pas lié', () => {
      expect(buildServiceOrderPrint(order()).vehicle).toEqual({ description: 'Renault Clio', plate: null, mileage: 50000 });
    });

    it('convertit la remise de l’ordre en dirhams', () => {
      const doc = buildServiceOrderPrint(order({ discount: '10.00', net_amount: '270.00' }));
      expect(doc.totals.discount_global).toBe(30);
      expect(doc.totals.net).toBe(270);
    });
  });
});
