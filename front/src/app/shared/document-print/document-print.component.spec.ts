import { DocumentPrintComponent, PrintDocument } from './document-print.component';

function makeDoc(overrides: Partial<PrintDocument> = {}): PrintDocument {
  return {
    type: 'sale',
    doc_number: '1',
    date: '2026-05-16',
    party_label: 'Client',
    party_name: 'Test',
    lines: [],
    total_ht: 0,
    net_amount: 0,
    ...overrides,
  };
}

describe('DocumentPrintComponent', () => {
  let comp: DocumentPrintComponent;

  beforeEach(() => {
    comp = Object.create(DocumentPrintComponent.prototype);
  });

  // -------------------------------------------------------------------------
  // getDocumentTitle
  // -------------------------------------------------------------------------

  describe('getDocumentTitle', () => {
    it('returns BON DE VENTE for sale', () => {
      comp.document = makeDoc({ type: 'sale' });
      expect(comp.getDocumentTitle()).toBe('BON DE VENTE');
    });

    it("returns BON D'ACHAT for purchase", () => {
      comp.document = makeDoc({ type: 'purchase' });
      expect(comp.getDocumentTitle()).toBe("BON D'ACHAT");
    });

    it("returns FICHE D'INTERVENTION for service_order", () => {
      comp.document = makeDoc({ type: 'service_order' });
      expect(comp.getDocumentTitle()).toBe("FICHE D'INTERVENTION");
    });
  });

  // -------------------------------------------------------------------------
  // hasDiscounts
  // -------------------------------------------------------------------------

  describe('hasDiscounts', () => {
    it('returns false when lines array is empty', () => {
      comp.document = makeDoc({ lines: [] });
      expect(comp.hasDiscounts()).toBe(false);
    });

    it('returns false when all discounts are 0', () => {
      comp.document = makeDoc({
        lines: [{ label: 'Pneu', qty: 2, unit_price: 100, discount: 0, total: 200 }],
      });
      expect(comp.hasDiscounts()).toBe(false);
    });

    it('returns false when discount is undefined', () => {
      comp.document = makeDoc({
        lines: [{ label: 'Pneu', qty: 1, unit_price: 100, total: 100 }],
      });
      expect(comp.hasDiscounts()).toBe(false);
    });

    it('returns true when at least one line has discount > 0', () => {
      comp.document = makeDoc({
        lines: [
          { label: 'Pneu A', qty: 1, unit_price: 100, discount: 0, total: 100 },
          { label: 'Pneu B', qty: 1, unit_price: 200, discount: 10, total: 180 },
        ],
      });
      expect(comp.hasDiscounts()).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // hasTransport
  // -------------------------------------------------------------------------

  describe('hasTransport', () => {
    it('returns false when no transport fields are set', () => {
      comp.document = makeDoc();
      expect(comp.hasTransport()).toBe(false);
    });

    it('returns true when carrier is set', () => {
      comp.document = makeDoc({ carrier: 'Transit Express' });
      expect(comp.hasTransport()).toBe(true);
    });

    it('returns true when tracking_number is set', () => {
      comp.document = makeDoc({ tracking_number: 'TRK-123' });
      expect(comp.hasTransport()).toBe(true);
    });

    it('returns true when partner is set', () => {
      comp.document = makeDoc({ partner: 'Partenaire SA' });
      expect(comp.hasTransport()).toBe(true);
    });

    it('returns true when payment_method is set', () => {
      comp.document = makeDoc({ payment_method: 'Virement' });
      expect(comp.hasTransport()).toBe(true);
    });

    it('returns false when all transport fields are null/undefined', () => {
      comp.document = makeDoc({
        carrier: null, tracking_number: null, partner: null,
        service: null, delivery_date: null, payment_method: null,
      });
      expect(comp.hasTransport()).toBe(false);
    });
  });
});
