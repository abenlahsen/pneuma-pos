import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { of, throwError } from 'rxjs';

import { DashboardComponent } from './dashboard.component';
import { DashboardService } from '../../core/services/dashboard.service';
import { AuthService } from '../../core/services/auth.service';
import { Router } from '@angular/router';

describe('DashboardComponent — liste de travail (5a/5b)', () => {
  let comp: DashboardComponent;
  let getWorkQueues: ReturnType<typeof vi.fn>;
  let navigate: ReturnType<typeof vi.fn>;

  function build() {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: DashboardService, useValue: { getWorkQueues, getKpi: () => of({}) } },
        { provide: AuthService, useValue: { user: () => ({ name: 'Ahmed' }), hasPermission: () => true } },
        { provide: Router, useValue: { navigate } },
      ],
    });
    return TestBed.runInInjectionContext(() => new DashboardComponent());
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    getWorkQueues = vi.fn().mockReturnValue(of({}));
    navigate = vi.fn();
  });

  it('additionne les lignes en attente de toutes les files', () => {
    getWorkQueues.mockReturnValue(of({
      unpaid: { scope: 'own', count: 3, total: 900, rows: [] },
      to_invoice: { scope: 'own', count: 2, total: 400, rows: [] },
      low_stock: { scope: 'shared', count: 6, total: null, rows: [] },
      quotes: { scope: 'own', count: 4, total: 62400, rows: [] },
    }));
    comp = build();
    comp.ngOnInit();

    expect(comp.pendingTotal()).toBe(15);
    expect(comp.hasAnyQueue()).toBe(true);
  });

  // ── « Commander » doit faire gagner du temps, pas seulement signaler ──────
  describe('commander', () => {
    it('ouvre un achat pre-rempli avec de quoi remonter au seuil', () => {
      comp = build();
      comp.order({
        product_id: 42, reference: 'REF-1', dimension: null,
        stock: 2, threshold: 6, stock_id: 7, unit_price: 480, supplier_id: 3,
      });

      expect(navigate).toHaveBeenCalledWith(['/achats'], {
        queryParams: {
          new: 1, product_id: 42, reference: 'REF-1', stock_id: 7, quantity: 4,
          unit_price: 480, supplier_id: 3,
        },
      });
    });

    // Stock au-dessus du seuil (cas limite) : on commande au moins une unite.
    it('ne propose jamais une quantite nulle', () => {
      comp = build();
      comp.order({
        product_id: 42, reference: null, dimension: null,
        stock: 9, threshold: 6, stock_id: 7, unit_price: 0, supplier_id: null,
      });

      expect(navigate.mock.calls[0][1].queryParams.quantity).toBe(1);
    });
  });

  it("n'affiche aucune file quand le serveur n'en renvoie aucune", () => {
    getWorkQueues.mockReturnValue(of({}));
    comp = build();
    comp.ngOnInit();

    expect(comp.hasAnyQueue()).toBe(false);
    expect(comp.pendingTotal()).toBe(0);
  });

  // ── Badges de portee : le possessif doit dire DE QUOI on est proprietaire ──
  describe('scopeLabel', () => {
    it('nomme les clients pour les files qui en ont', () => {
      comp = build();

      expect(comp.scopeLabel('unpaid', 'own')).toBe('Mes clients');
      expect(comp.scopeLabel('unpaid', 'all')).toBe('Toutes agences');
      expect(comp.scopeLabel('to_invoice', 'own')).toBe('Mes clients');
      expect(comp.scopeLabel('to_invoice', 'all')).toBe('Toutes agences');
    });

    // Le stock n'a pas de proprietaire : le premier qui le voit commande.
    it('marque la file stock comme partagee quelle que soit la portee', () => {
      comp = build();

      expect(comp.scopeLabel('low_stock', 'shared')).toBe('Agence · partagé');
      expect(comp.scopeLabel('low_stock', 'all')).toBe('Agence · partagé');
    });

    // Le possessif dit de QUOI on est proprietaire : des devis, pas des clients.
    it('nomme les devis pour la file des devis', () => {
      comp = build();

      expect(comp.scopeLabel('quotes', 'own')).toBe('Mes devis');
      expect(comp.scopeLabel('quotes', 'all')).toBe('Toutes agences');
    });
  });

  describe('queueTitle', () => {
    it('porte le possessif en portee personnelle', () => {
      comp = build();

      expect(comp.queueTitle('unpaid', 'own')).toBe('Mes impayés');
      expect(comp.queueTitle('to_invoice', 'own')).toBe('Mes ordres à facturer');
    });

    it('le retire en portee agence', () => {
      comp = build();

      expect(comp.queueTitle('unpaid', 'all')).toBe('Impayés à relancer');
      expect(comp.queueTitle('to_invoice', 'all')).toBe('Ordres terminés à facturer');
    });

    it('nomme la file stock sans possessif', () => {
      comp = build();

      expect(comp.queueTitle('low_stock', 'shared')).toBe('Produits sous seuil');
    });

    it('porte le possessif sur les devis en portee personnelle', () => {
      comp = build();

      expect(comp.queueTitle('quotes', 'own')).toBe('Mes devis sans réponse');
      expect(comp.queueTitle('quotes', 'all')).toBe('Devis sans réponse');
    });
  });

  // ── Libelles d'action : le gerant distribue le travail, il ne le fait pas ──
  describe('actionLabel', () => {
    it('bascule de Relancer a Assigner selon la portee', () => {
      comp = build();

      expect(comp.actionLabel('unpaid', 'own')).toBe('Relancer');
      expect(comp.actionLabel('unpaid', 'all')).toBe('Assigner');
    });

    it('ne bascule pas ce qui ne se delegue pas', () => {
      comp = build();

      expect(comp.actionLabel('to_invoice', 'own')).toBe('Facturer');
      expect(comp.actionLabel('to_invoice', 'all')).toBe('Facturer');
      expect(comp.actionLabel('low_stock', 'shared')).toBe('Commander');
      expect(comp.actionLabel('quotes', 'own')).toBe('Rappeler');
      expect(comp.actionLabel('quotes', 'all')).toBe('Rappeler');
    });

    // Primaire pour Facturer seul : c'est la seule action qui conclut.
    it('reserve le bouton primaire a Facturer', () => {
      comp = build();

      expect(comp.isPrimaryAction('to_invoice')).toBe(true);
      expect(comp.isPrimaryAction('unpaid')).toBe(false);
      expect(comp.isPrimaryAction('low_stock')).toBe(false);
      expect(comp.isPrimaryAction('quotes')).toBe(false);
    });
  });

  it('ouvre la vente pour encaisser un impaye', () => {
    comp = build();
    comp.openSale(1031);

    expect(navigate).toHaveBeenCalledWith(['/sales'], { queryParams: { id: 1031 } });
  });

  it('ouvre l ordre de service pour le facturer', () => {
    comp = build();
    comp.openServiceOrder(77);

    expect(navigate).toHaveBeenCalledWith(['/service-orders'], { queryParams: { id: 77 } });
  });

  describe('isOverdue', () => {
    it('est faux sans date', () => {
      comp = build();
      expect(comp.isOverdue(null)).toBe(false);
      expect(comp.isOverdue('pas une date')).toBe(false);
    });

    it('est vrai au-dela du delai', () => {
      comp = build();
      const old = new Date(Date.now() - 40 * 86_400_000).toISOString();
      expect(comp.isOverdue(old)).toBe(true);
    });

    it('est faux en deca du delai', () => {
      comp = build();
      const recent = new Date(Date.now() - 3 * 86_400_000).toISOString();
      expect(comp.isOverdue(recent)).toBe(false);
    });
  });

  describe('colonne des chiffres (5a/5b)', () => {
    const figures = (over: Record<string, unknown> = {}) => ({
      scope: 'own',
      today: { sales: 2, revenue: 4800, margin: 900, open_orders: 3 },
      month: { revenue: 113545, margin: 12842, agency_average: null, target: null },
      ranking: [],
      trend: [],
      ...over,
    });

    it("n'affiche pas de chiffres quand le serveur n'en renvoie pas", () => {
      getWorkQueues.mockReturnValue(of({ unpaid: { scope: 'own', count: 0, total: 0, rows: [] } }));
      comp = build();
      comp.ngOnInit();

      expect(comp.figures()).toBeNull();
      expect(comp.isAgencyScope()).toBe(false);
    });

    // La portee vient du serveur : le front ne la deduit pas d'une permission
    // locale, il rapporte ce que la requete a reellement filtre.
    it('reserve la portee agence a ce que le serveur a rapporte', () => {
      getWorkQueues.mockReturnValue(of({ figures: figures({ scope: 'all' }) }));
      comp = build();
      comp.ngOnInit();

      expect(comp.isAgencyScope()).toBe(true);
    });

    it('ne compte pas les chiffres comme des lignes en attente', () => {
      getWorkQueues.mockReturnValue(of({ figures: figures() }));
      comp = build();
      comp.ngOnInit();

      expect(comp.pendingTotal()).toBe(0);
      expect(comp.hasAnyQueue()).toBe(false);
    });

    it('dimensionne les barres du classement sur le meilleur CA', () => {
      getWorkQueues.mockReturnValue(of({
        figures: figures({
          scope: 'all',
          ranking: [
            { id: 1, name: 'Azeddine', revenue: 80000, unpaid: 40000 },
            { id: 2, name: 'Ahmed', revenue: 20000, unpaid: 0 },
          ],
        }),
      }));
      comp = build();
      comp.ngOnInit();

      expect(comp.rankingPct(80000)).toBe(100);
      expect(comp.rankingPct(20000)).toBe(25);
      // L'impaye se lit sur la meme echelle que le CA, sinon la barre ment.
      expect(comp.rankingPct(40000)).toBe(50);
    });

    it('ne divise pas par zero quand personne n a vendu', () => {
      getWorkQueues.mockReturnValue(of({
        figures: figures({ scope: 'all', ranking: [{ id: 1, name: 'Azeddine', revenue: 0, unpaid: 0 }] }),
      }));
      comp = build();
      comp.ngOnInit();

      expect(comp.rankingPct(0)).toBe(0);
    });

    // ── Tendance en barres : trente jours, creux compris ───────────────────
    it('dimensionne chaque barre sur le plus haut jour', () => {
      getWorkQueues.mockReturnValue(of({
        figures: figures({
          scope: 'all',
          trend: [
            { date: '2026-09-01', revenue: 0 },
            { date: '2026-09-02', revenue: 2000 },
            { date: '2026-09-03', revenue: 1000 },
          ],
        }),
      }));
      comp = build();
      comp.ngOnInit();

      const bars = comp.trendBars();
      expect(bars).toHaveLength(3);
      // Un jour creux garde une barre visible : c'est ce qu'une courbe cachait.
      expect(bars[0].height).toBe(0);
      expect(bars[1].height).toBe(100);
      expect(bars[2].height).toBe(50);
      // Le dernier jour porte l'accent : c'est aujourd'hui.
      expect(bars[2].isToday).toBe(true);
      expect(bars[1].isToday).toBe(false);
    });

    it('place le trait de moyenne a sa hauteur reelle', () => {
      getWorkQueues.mockReturnValue(of({
        figures: figures({
          scope: 'all',
          trend: [
            { date: '2026-09-01', revenue: 0 },
            { date: '2026-09-02', revenue: 2000 },
          ],
        }),
      }));
      comp = build();
      comp.ngOnInit();

      expect(comp.trendAverage()).toBe(1000);
      expect(comp.trendAveragePct()).toBe(50);
    });

    it('ne divise pas par zero quand aucun jour n a vendu', () => {
      getWorkQueues.mockReturnValue(of({
        figures: figures({ scope: 'all', trend: [{ date: '2026-09-01', revenue: 0 }] }),
      }));
      comp = build();
      comp.ngOnInit();

      expect(comp.trendBars()[0].height).toBe(0);
      expect(comp.trendAveragePct()).toBe(0);
    });

    // ── Barre d'objectif ───────────────────────────────────────────────────
    it('mesure le mois contre l objectif', () => {
      getWorkQueues.mockReturnValue(of({
        figures: figures({ month: { revenue: 340000, margin: 0, agency_average: null, target: 400000 } }),
      }));
      comp = build();
      comp.ngOnInit();

      expect(comp.targetPct()).toBe(85);
    });

    // Depasser l'objectif ne doit pas faire deborder la barre.
    it('plafonne la barre a cent pour cent', () => {
      getWorkQueues.mockReturnValue(of({
        figures: figures({ month: { revenue: 900000, margin: 0, agency_average: null, target: 400000 } }),
      }));
      comp = build();
      comp.ngOnInit();

      expect(comp.targetPct()).toBe(100);
    });

    it('ne mesure rien sans objectif fixe', () => {
      getWorkQueues.mockReturnValue(of({ figures: figures() }));
      comp = build();
      comp.ngOnInit();

      expect(comp.targetPct()).toBeNull();
    });

  });

  it('expose le detail technique quand le chargement echoue', () => {
    getWorkQueues.mockReturnValue(throwError(() => ({ url: '/api/work-queues', status: 503 })));
    comp = build();
    comp.ngOnInit();

    expect(comp.loadError()).toContain('/api/work-queues');
    expect(comp.loadError()).toContain('503');
    expect(comp.loading()).toBe(false);
  });
});

/**
 * Rendu reel du gabarit. La suite ci-dessus n'assène que des assertions de
 * classe : elle passerait meme si le gabarit n'affichait rien. Ces tests-ci
 * couvrent la portee commercial, qu'un compte administrateur ne montre jamais
 * a l'ecran — il a `view reporting.all` et bascule toujours en portee agence.
 */
describe('DashboardComponent — rendu en portee commercial', () => {
  let fixture: ComponentFixture<DashboardComponent>;
  let text: string;

  const commercialQueues = {
    unpaid: {
      scope: 'own', count: 2, total: 17110,
      rows: [{ id: 85, date: '2026-09-01', client: 'ABDELLAH BAALIKI', phone: null, commercial: 'Mariem', amount: 1260, payment_status: 'NON PAYE' }],
    },
    to_invoice: { scope: 'own', count: 1, total: 6140, rows: [] },
    low_stock: {
      scope: 'shared', count: 6, total: null,
      rows: [{ product_id: 3, reference: 'M120701251P-CG', dimension: '120/70R12', stock: 1, threshold: 5, stock_id: 3, unit_price: 450, supplier_id: null }],
    },
    quotes: {
      scope: 'own', count: 2, total: 39200,
      rows: [{ id: 1, reference: 'DEV-0309', client: 'Transport Chaouia', commercial: 'Omar', issued_at: '2026-08-29', days_waiting: 16, amount: 26800 }],
    },
    figures: {
      scope: 'own',
      today: { sales: 2, revenue: 4800, margin: 900, open_orders: 3 },
      month: { revenue: 340000, margin: 40000, agency_average: 355000, target: 400000 },
      ranking: [],
      trend: [],
    },
  };

  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: DashboardService, useValue: { getWorkQueues: () => of(commercialQueues), getKpi: () => of({}) } },
        { provide: AuthService, useValue: { user: () => ({ name: 'Omar' }), hasPermission: () => true } },
        { provide: Router, useValue: { navigate: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    text = fixture.nativeElement.textContent ?? '';
  });

  it('porte le possessif dans les titres et nomme les clients dans les badges', () => {
    expect(text).toContain('Mes impayés');
    expect(text).toContain('Mes ordres à facturer');
    expect(text).toContain('Mes clients');
    expect(text).toContain('Mes devis sans réponse');
    expect(text).toContain('Mes devis');
    expect(text).not.toContain('Toutes agences');
  });

  it('propose de relancer, pas d assigner', () => {
    const boutons = [...fixture.nativeElement.querySelectorAll('.task button')].map((b: any) => b.textContent.trim());

    expect(boutons).toContain('Relancer');
    expect(boutons).not.toContain('Assigner');
  });

  it('affiche le compte et le montant de chaque file', () => {
    const compteurs = [...fixture.nativeElement.querySelectorAll('.queue-count')].map((e: any) => e.textContent.replace(/\s+/g, ' ').trim());

    expect(compteurs[0]).toContain('2');
    expect(compteurs[0]).toContain('17,110');
    // La file stock compte des articles : pas de montant.
    expect(compteurs[2]).toBe('6');
  });

  // Un commercial ne classe pas ses collegues, et ne voit pas la tendance.
  it('ne montre ni classement nominatif ni tendance', () => {
    expect(fixture.nativeElement.querySelector('.rank')).toBeNull();
    expect(fixture.nativeElement.querySelector('.trend')).toBeNull();
    expect(text).not.toContain('Classement du mois');
  });

  it('montre ses chiffres du jour en liste', () => {
    const lignes = [...fixture.nativeElement.querySelectorAll('.side-row')].map((e: any) => e.textContent.replace(/\s+/g, ' ').trim());

    expect(lignes).toHaveLength(4);
    expect(lignes[0]).toContain('Chiffre d’affaires');
    expect(lignes[3]).toContain('Ordres ouverts');
  });

  it('mesure son mois contre son objectif et le situe sans nommer personne', () => {
    const barre = fixture.nativeElement.querySelector('.target-fill') as HTMLElement;

    expect(barre).not.toBeNull();
    expect(barre.style.width).toBe('85%');
    expect(text).toContain('85 % de l’objectif mensuel');
    expect(text).toContain('Moyenne agence');
    expect(text).toContain('en dessous');
    expect(text).not.toContain('Azeddine');
  });

  it('affiche l article sous seuil avec son stock et son seuil', () => {
    expect(text).toContain('M120701251P-CG');
    expect(text).toContain('120/70R12');
    expect(text).toContain('seuil 5');
    expect(fixture.nativeElement.querySelector('.t-stock-n').textContent.trim()).toBe('1');
  });
});
