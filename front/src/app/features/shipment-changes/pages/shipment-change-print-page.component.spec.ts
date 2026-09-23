import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { ShipmentChangePrintPageComponent } from './shipment-change-print-page.component';
import { ShipmentChangeService } from '../data-access/shipment-change.service';
import { PrintService } from '../../../core/services/print.service';
import {
  ShipmentChangeField,
  ShipmentChangeItem,
  ShipmentChangeRequest,
} from '../models/shipment-change.model';

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

  // ── Le logo ────────────────────────────────────────────────────────────────

  describe('logo', () => {
    it('affiche l’image quand les paramètres en annoncent une', () => {
      Object.assign(comp, {
        settings: () => ({ logo_url: '/storage/logo.png', company_name: 'PNEU.MA' }),
        logoFailed: () => false,
      });
      expect(comp.showLogo()).toBe(true);
    });

    it('retombe sur le nom quand aucune image n’est enregistrée', () => {
      Object.assign(comp, { settings: () => ({ company_name: 'PNEU.MA' }), logoFailed: () => false });
      expect(comp.showLogo()).toBe(false);
    });

    it('retombe sur le nom quand le fichier a disparu du stockage', () => {
      // `logo_url` est construite depuis le chemin en base : elle reste valide
      // même si l'image n'existe plus. Seule l'erreur de chargement le dit.
      Object.assign(comp, {
        settings: () => ({ logo_url: '/storage/absent.png', company_name: 'PNEU.MA' }),
        logoFailed: () => true,
      });
      expect(comp.showLogo()).toBe(false);
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

// ── Le dépassement d'une page ────────────────────────────────────────────────
//
// La feuille est de hauteur fixe et `overflow: hidden` : ce qui dépasse est
// coupé, en commençant par le bas — donc par les signatures. Ce qui est sous
// test ici, c'est ce que la page FAIT de ce constat.

const CHAMPS: ShipmentChangeField[] = [
  'payment_method',
  'recipient_name',
  'recipient_phone',
  'address',
  'city',
  'amount',
  'other',
];

/** Dix lignes de modification, valeurs longues, et un motif à rallonge. */
function longRequest(): ShipmentChangeRequest {
  const items: ShipmentChangeItem[] = Array.from({ length: 10 }, (_, i) => ({
    id: i + 1,
    field: CHAMPS[i % CHAMPS.length],
    custom_label: `Précision complémentaire n° ${i + 1}`,
    old_value: `Ancienne valeur ${i + 1} — Km 8, route de Rabat, zone industrielle, Casablanca`,
    new_value: `Nouvelle valeur ${i + 1} — Rue 14, zone industrielle Aïn Sebaâ, lot 32, Casablanca`,
  }));

  return makeRequest({
    items,
    reason:
      'Le client a demandé une livraison sur son second dépôt, où le montage est prévu. ' +
      "Merci de modifier l'expédition avant la tournée du 18/09, faute de quoi le camion " +
      'se présentera à une adresse où personne ne pourra réceptionner les colis, et la ' +
      'marchandise repartira en souffrance pour une semaine complète.',
  });
}

describe('ShipmentChangePrintPageComponent — dépassement', () => {
  function mount(request: ShipmentChangeRequest) {
    // Deux configurations cohabitent dans ce fichier : TestBed n'en accepte
    // qu'une par module instancié.
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: ShipmentChangeService, useValue: { get: () => of(request) } },
        {
          provide: PrintService,
          useValue: {
            getSettings: () => of({ company_name: 'PNEU.MA', city: 'Casablanca' }),
            downloadPdf: vi.fn(),
          },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of({ get: () => '142' }),
            snapshot: { paramMap: { get: () => '142' } },
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(ShipmentChangePrintPageComponent);
    fixture.detectChanges();
    return fixture;
  }

  /**
   * Le lanceur tourne sous jsdom, qui ne calcule AUCUNE mise en page :
   * `scrollHeight` et `clientHeight` y valent 0 quel que soit le contenu, et
   * aucune quantité de lignes n'y produira de dépassement spontané. On pose
   * donc la géométrie à la main, puis on rappelle la mesure.
   *
   * La géométrie réelle, elle, a été mesurée dans un navigateur sur une feuille
   * de 210 × 297 mm — les chiffres sont consignés dans la feuille de style. Ce
   * test-ci vérifie le câblage : ce que la page fait quand ça dépasse.
   */
  function fakeGeometry(fixture: ReturnType<typeof mount>, contenu: number, page: number) {
    const paper = fixture.nativeElement.querySelector('.scp-paper') as HTMLElement;
    Object.defineProperty(paper, 'scrollHeight', { value: contenu, configurable: true });
    Object.defineProperty(paper, 'clientHeight', { value: page, configurable: true });

    fixture.componentInstance.measureOverflow();
    fixture.detectChanges();
    return paper;
  }

  const banner = (fixture: ReturnType<typeof mount>) =>
    fixture.nativeElement.querySelector('.scp-overflow') as HTMLElement | null;

  const buttons = (fixture: ReturnType<typeof mount>) => {
    const all = [...fixture.nativeElement.querySelectorAll('.scp-btn')] as HTMLButtonElement[];
    return {
      imprimer: all.find((b) => b.textContent?.includes('Imprimer'))!,
      pdf: all.find((b) => b.textContent?.includes('Télécharger PDF'))!,
    };
  };

  it('dix lignes et un motif long qui débordent : bandeau, et les deux boutons coupés', () => {
    const fixture = mount(longRequest());

    // 1 283 px de contenu pour 1 121 px de page : les proportions relevées au
    // navigateur sur ce volume de contenu.
    fakeGeometry(fixture, 1283, 1121);

    expect(banner(fixture)).not.toBeNull();
    expect(banner(fixture)!.textContent).toContain('Le document dépasse une page');
    expect(banner(fixture)!.textContent).toContain('répartissez les modifications sur deux demandes');

    const { imprimer, pdf } = buttons(fixture);
    expect(imprimer.disabled).toBe(true);
    expect(pdf.disabled).toBe(true);
  });

  it('la même demande qui tient dans la page : ni bandeau ni bouton coupé', () => {
    const fixture = mount(longRequest());

    fakeGeometry(fixture, 1121, 1121);

    expect(banner(fixture)).toBeNull();

    const { imprimer, pdf } = buttons(fixture);
    expect(imprimer.disabled).toBe(false);
    expect(pdf.disabled).toBe(false);
  });

  it('un pixel d’écart ne compte pas pour un dépassement', () => {
    const fixture = mount(longRequest());

    // Un arrondi sous-pixel ne doit pas condamner un document valide.
    fakeGeometry(fixture, 1122, 1121);

    expect(banner(fixture)).toBeNull();
    expect(buttons(fixture).imprimer.disabled).toBe(false);
  });

  it('les actions refusent d’agir, pas seulement les boutons de se laisser cliquer', () => {
    const fixture = mount(longRequest());
    fakeGeometry(fixture, 1283, 1121);

    const comp = fixture.componentInstance;
    const pdf = TestBed.inject(PrintService).downloadPdf as ReturnType<typeof vi.fn>;
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});

    comp.print();
    void comp.downloadPdf();

    expect(printSpy).not.toHaveBeenCalled();
    expect(pdf).not.toHaveBeenCalled();

    printSpy.mockRestore();
  });

  it('le bandeau ne part jamais sur le papier', () => {
    const fixture = mount(longRequest());
    fakeGeometry(fixture, 1283, 1121);

    // `no-print` est ce que le bloc @media print global de styles.scss masque ;
    // et le bandeau est hors de la feuille, donc hors de `.print-area`.
    expect(banner(fixture)!.classList.contains('no-print')).toBe(true);
    expect(banner(fixture)!.closest('.scp-paper')).toBeNull();
  });
});
