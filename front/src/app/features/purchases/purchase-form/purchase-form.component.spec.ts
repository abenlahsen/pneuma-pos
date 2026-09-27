import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { of } from 'rxjs';

import { PurchaseFormComponent, PurchaseLine } from './purchase-form.component';
import { PurchaseService } from '../data-access/purchase.service';
import { SupplierService } from '../../suppliers/data-access/supplier.service';
import { PurchaseCatalogProduct } from '../models/purchase.model';

/**
 * Refonte 2b, 12b — la saisie d'achat. La logique pure : hausse de prix,
 * marge, lignes, total dû, et ce qui part à l'API.
 */
const purchaseServiceStub = {
  getCatalog: () => of({ data: [] }),
  getFilters: () => of({ suppliers: [], commercials: [] }),
};
const supplierServiceStub = {
  getSuppliers: () => of([]),
  getSupplierProfile: () => of({ supplier: {}, outstanding_balance: 0, purchases: [] }),
};

function product(over: Partial<PurchaseCatalogProduct> = {}): PurchaseCatalogProduct {
  return {
    id: 7,
    type: 'tyre',
    brand: 'Michelin',
    profile: 'Primacy 4',
    reference: 'REF',
    dimension: '205/55R16 91V',
    stock_total: 4,
    lots: [{ id: 31, depot: 'Casablanca', zone: 'A-12', dot: '2425', quantity: 4, purchase_price: 790 }],
    last_purchase: { unit_price: 812, date: '2026-05-14', purchase_id: 1, supplier_id: 3, supplier_name: 'Michelin Maroc' },
    supplier_last_purchase: null,
    bought_from_supplier: false,
    last_sale_price: 1180,
    ...over,
  };
}

function line(over: Partial<PurchaseLine> = {}): PurchaseLine {
  return { product_id: 7, stock_id: 31, quantity: 48, unit_price: 830, info: product(), ...over };
}

describe('PurchaseFormComponent', () => {
  let comp: PurchaseFormComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PurchaseFormComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: PurchaseService, useValue: purchaseServiceStub },
        { provide: SupplierService, useValue: supplierServiceStub },
      ],
    }).compileComponents();

    comp = TestBed.createComponent(PurchaseFormComponent).componentInstance;
  });

  describe('la hausse de prix', () => {
    it('signale un prix supérieur au dernier achat connu, avec le pourcentage', () => {
      comp.supplierId.set(3);
      const l = line();
      expect(comp.priceRise(l)).toBeCloseTo(2.217, 2);
      expect(comp.priceRiseLabel(l)).toBe('Prix supérieur de 2,2 % au dernier achat (812 DH le 14/05).');
    });

    it('nomme le fournisseur quand le dernier achat s’est fait ailleurs', () => {
      comp.supplierId.set(9);
      expect(comp.priceRiseLabel(line())).toContain('chez Michelin Maroc');
    });

    it('ne dit rien pour un prix égal ou inférieur, ni sans achat antérieur', () => {
      expect(comp.priceRise(line({ unit_price: 812 }))).toBeNull();
      expect(comp.priceRise(line({ unit_price: 700 }))).toBeNull();
      expect(comp.priceRise(line({ info: product({ last_purchase: null }) }))).toBeNull();
    });
  });

  describe('la sous-ligne', () => {
    it('donne la marge laissée au dernier prix de vente', () => {
      // (1180 − 830) / 1180
      expect(comp.lineMarginPct(line())).toBeCloseTo(29.66, 1);
    });

    it('n’invente pas de marge sans prix de vente connu', () => {
      expect(comp.lineMarginPct(line({ info: product({ last_sale_price: null }) }))).toBeNull();
    });
  });

  describe('l’ajout', () => {
    it('propose le dernier prix chez ce fournisseur, puis le dernier prix, puis celui du lot', () => {
      comp.addProduct(product({ supplier_last_purchase: { unit_price: 800, date: '2026-04-01', purchase_id: 2, supplier_id: 3, supplier_name: 'M' } }));
      comp.addProduct(product({ id: 8 }));
      comp.addProduct(product({ id: 9, last_purchase: null }));
      expect(comp.lines().map(l => l.unit_price)).toEqual([800, 812, 790]);
      expect(comp.lines()[0].stock_id).toBe(31);
    });

    it('marque « ajouté » un produit déjà dans les lignes', () => {
      comp.addProduct(product());
      expect(comp.isAdded(product())).toBe(true);
      expect(comp.isAdded(product({ id: 99 }))).toBe(false);
    });
  });

  describe('les totaux et le fournisseur', () => {
    it('calcule le total, la remise en pourcentage et le net', () => {
      comp.lines.set([line({ quantity: 2, unit_price: 1000 }), line({ product_id: 8, quantity: 1, unit_price: 500 })]);
      comp.discount.set(10);
      expect(comp.linesTotal()).toBe(2500);
      expect(comp.discountAmount()).toBe(250);
      expect(comp.netAmount()).toBe(2250);
    });

    it('ajoute cet achat au dû du fournisseur', () => {
      comp.supplierId.set(3);
      comp.supplierProfile.set({ outstanding_balance: 180500, purchases: [] } as any);
      comp.lines.set([line({ quantity: 1, unit_price: 1000 })]);
      expect(comp.alreadyDue()).toBe(180500);
      expect(comp.dueAfter()).toBe(181500);
    });

    it('calcule l’échéance sur le délai contractuel', () => {
      comp.suppliers.set([{ id: 3, name: 'M', payment_terms_days: 60 } as any]);
      comp.supplierId.set(3);
      comp.date.set('2026-09-17');
      expect(comp.dueDate()).toBe('2026-11-16');
    });
  });

  describe('ce qui part à l’API', () => {
    it('refuse d’enregistrer sans fournisseur, sans ligne ou sans dépôt', () => {
      expect(comp.missingHint()).toBe('Choisissez le fournisseur.');
      comp.supplierId.set(3);
      expect(comp.missingHint()).toBe('Ajoutez au moins un produit.');
      comp.lines.set([line({ stock_id: null })]);
      expect(comp.missingHint()).toBe('Chaque ligne doit avoir un dépôt de réception.');
      comp.lines.set([line()]);
      expect(comp.canSave()).toBe(true);
    });

    it('traduit la réception en statut, et n’envoie pas de n° de facture pour un BL seul', () => {
      comp.supplierId.set(3);
      comp.lines.set([line()]);
      comp.withInvoice.set(false);
      comp.invoiceNumber.set('F-1');
      comp.reception.set('received');

      const payload = comp.buildPayload();
      expect(payload.status).toBe('RECU');
      expect(payload.with_invoice).toBe(false);
      expect(payload.invoice_number).toBeNull();
      expect(payload.items).toEqual([{ product_id: 7, stock_id: 31, quantity: 48, unit_price: 830 }]);
    });

    it('émet la réception et « payé maintenant » avec le corps', () => {
      comp.supplierId.set(3);
      comp.lines.set([line()]);
      comp.payNow.set(true);
      const emitted: any[] = [];
      comp.save.subscribe(e => emitted.push(e));
      comp.onSubmit();
      expect(emitted[0].reception).toBe('expected');
      expect(emitted[0].payNow).toBe(true);
    });
  });
});
