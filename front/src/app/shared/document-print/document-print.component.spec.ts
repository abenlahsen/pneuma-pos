import { DocumentPrintComponent, PrintDocument, formatMoney } from './document-print.component';

function makeDoc(overrides: Partial<PrintDocument> = {}): PrintDocument {
  return {
    type: 'sale',
    title: 'Facture',
    doc_number: 'N° 1',
    date: '2026-07-02',
    party: { label: 'Client', name: 'Test', lines: [] },
    lines: [],
    allow_discount_column: true,
    totals: { lines_total: 0, net: 0, paid: 0 },
    vat_applies: true,
    headline_label: 'Net à payer',
    info: [],
    amount_in_words_intro: 'Arrêtée la présente facture',
    receipt_box_title: 'Reçu par le client',
    ...overrides,
  };
}

const NBSP = String.fromCharCode(0xa0); // espace insecable

describe('DocumentPrintComponent', () => {
  let comp: DocumentPrintComponent;

  beforeEach(() => {
    // Pas d'inject() dans ce composant : `new` suffit, sans TestBed.
    comp = new DocumentPrintComponent();
    comp.settings = { vat_rate: 20, city: 'Casablanca' } as any;
  });

  describe('formatMoney', () => {
    it('écrit 17 556,48 avec une espace insécable ordinaire', () => {
      expect(formatMoney(17556.48)).toBe(`17${NBSP}556,48`);
      expect(formatMoney(0)).toBe('0,00');
    });
  });

  describe('getDocumentTitle', () => {
    it('imprime le titre du document en capitales', () => {
      comp.document = makeDoc({ title: "Bon d'achat" });
      expect(comp.getDocumentTitle()).toBe("BON D'ACHAT");
    });
  });

  describe('hasDiscounts', () => {
    it('est faux sans remise de ligne', () => {
      comp.document = makeDoc({ lines: [{ label: 'Pneu', qty: 2, unit_price: 100, discount: 0, total: 200 }] });
      expect(comp.hasDiscounts()).toBe(false);
    });

    it('est vrai dès qu’une ligne porte une remise', () => {
      comp.document = makeDoc({
        lines: [
          { label: 'A', qty: 1, unit_price: 100, total: 100 },
          { label: 'B', qty: 1, unit_price: 200, discount: 10, total: 180 },
        ],
      });
      expect(comp.hasDiscounts()).toBe(true);
    });

    it('reste faux quand le document interdit la colonne (achat)', () => {
      comp.document = makeDoc({
        allow_discount_column: false,
        lines: [{ label: 'B', qty: 1, unit_price: 200, discount: 10, total: 180 }],
      });
      expect(comp.hasDiscounts()).toBe(false);
    });
  });

  describe('vat', () => {
    it('reconstitue le hors-taxe d’un net TTC — maquette 19a', () => {
      comp.document = makeDoc({ totals: { lines_total: 17556.48, net: 17556.48, paid: 0 } });
      expect(comp.vat()).toEqual({ rate: 20, ht: 14630.4, tva: 2926.08 });
    });

    it('fait retomber HT + TVA au centime sur le net, même quand la division ne tombe pas juste', () => {
      comp.document = makeDoc({ totals: { lines_total: 100, net: 100, paid: 0 } });
      const v = comp.vat()!;
      expect(v.ht).toBe(83.33);
      expect(Math.round((v.ht + v.tva) * 100) / 100).toBe(100);
    });

    it('lit le taux en chaîne, tel que l’API le renvoie', () => {
      comp.settings = { vat_rate: '7.00' } as any;
      comp.document = makeDoc({ totals: { lines_total: 107, net: 107, paid: 0 } });
      expect(comp.vat()).toEqual({ rate: 7, ht: 100, tva: 7 });
    });

    it('accepte un taux nul (exonération) au lieu de l’ignorer', () => {
      comp.settings = { vat_rate: 0 } as any;
      comp.document = makeDoc({ totals: { lines_total: 50, net: 50, paid: 0 } });
      expect(comp.vat()).toEqual({ rate: 0, ht: 50, tva: 0 });
    });

    it('est nul hors facture', () => {
      comp.document = makeDoc({ vat_applies: false, totals: { lines_total: 100, net: 100, paid: 0 } });
      expect(comp.vat()).toBeNull();
    });

    it('est nul tant que le taux n’est pas connu', () => {
      comp.settings = null;
      comp.document = makeDoc({ totals: { lines_total: 100, net: 100, paid: 0 } });
      expect(comp.vat()).toBeNull();
    });
  });

  describe('paymentState', () => {
    it('dit PAYÉ quand rien ne reste dû', () => {
      comp.document = makeDoc({ totals: { lines_total: 100, net: 100, paid: 100 } });
      expect(comp.paymentState()).toBe('PAYÉ');
    });

    it('dit PAYÉ aussi quand le payé dépasse le net', () => {
      comp.document = makeDoc({ totals: { lines_total: 100, net: 100, paid: 120 } });
      expect(comp.paymentState()).toBe('PAYÉ');
      expect(comp.remaining()).toBe(0);
    });

    it('dit PARTIEL avec le reste dû — maquette 19a', () => {
      comp.document = makeDoc({ totals: { lines_total: 17556.48, net: 17556.48, paid: 2360 } });
      expect(comp.paymentState()).toBe(`PARTIEL · RESTE DÛ 15${NBSP}196,48`);
    });

    it('dit NON PAYÉ sans aucun paiement', () => {
      comp.document = makeDoc({ totals: { lines_total: 100, net: 100, paid: 0 } });
      expect(comp.paymentState()).toBe('NON PAYÉ');
    });
  });

  describe('montant en toutes lettres', () => {
    it('écrit le net, et « toutes taxes comprises » seulement sur une facture', () => {
      comp.document = makeDoc({ totals: { lines_total: 17556.48, net: 17556.48, paid: 0 } });
      expect(comp.amountInWords()).toBe('dix-sept mille cinq cent cinquante-six dirhams et quarante-huit centimes');
      expect(comp.amountInWordsSuffix()).toBe(' toutes taxes comprises.');

      comp.document = makeDoc({ vat_applies: false });
      expect(comp.amountInWordsSuffix()).toBe('.');
    });
  });

  describe('placeAndDate', () => {
    it('écrit le lieu, la date et le complément de référence', () => {
      comp.document = makeDoc({ reference_note: 'BL n° 88' });
      expect(comp.placeAndDate()).toBe('Casablanca, le 02/07/2026 · BL n° 88');
    });

    it('se passe de la ville quand elle n’est pas renseignée', () => {
      comp.settings = {} as any;
      comp.document = makeDoc();
      expect(comp.placeAndDate()).toBe('Le 02/07/2026');
    });
  });

  describe('émetteur et mentions légales', () => {
    it('met l’émetteur en deux lignes sous le logo', () => {
      comp.settings = {
        company_name: 'PNEU.MA', legal_name: 'PNEU.MA SARL', address: 'Bd. Mohammed V, 214',
        city: 'Casablanca', phone: '0522 00 00 00', email: 'contact@pneu.ma',
      } as any;
      expect(comp.issuerLines()).toEqual([
        'PNEU.MA SARL · Bd. Mohammed V, 214 · Casablanca',
        '0522 00 00 00 · contact@pneu.ma',
      ]);
    });

    it('accole le nom commercial à une raison sociale réduite à la forme juridique', () => {
      comp.settings = { company_name: 'PNEU.MA', legal_name: 'SARL AU', rc: '289511' } as any;
      expect(comp.issuerName()).toBe('PNEU.MA SARL AU');
      expect(comp.legalMentions()).toEqual(['PNEU.MA SARL AU', 'RC 289511']);
    });

    it('garde la raison sociale seule quand elle contient déjà le nom commercial', () => {
      comp.settings = { company_name: 'PNEU.MA', legal_name: 'PNEU.MA SARL' } as any;
      expect(comp.issuerName()).toBe('PNEU.MA SARL');
      comp.settings = { company_name: 'PNEU.MA', legal_name: null } as any;
      expect(comp.issuerName()).toBe('PNEU.MA');
    });

    it('n’imprime que les identifiants renseignés', () => {
      comp.settings = { company_name: 'PNEU.MA', legal_name: null, rc: '481223', ice: '002345678000091', tax_id: null, cnss: '', patente: null } as any;
      expect(comp.legalMentions()).toEqual(['PNEU.MA', 'RC 481223', 'ICE 002345678000091']);
    });
  });

  describe('showLogo', () => {
    it('retombe sur le nom quand l’image n’a pas pu être chargée', () => {
      comp.settings = { logo_url: '/storage/logo.png' } as any;
      expect(comp.showLogo()).toBe(true);
      comp.logoFailed.set(true);
      expect(comp.showLogo()).toBe(false);
    });
  });
});
