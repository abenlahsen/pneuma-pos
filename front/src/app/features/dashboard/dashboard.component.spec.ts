import { TestBed } from '@angular/core/testing';
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
      unpaid: { scope: 'own', count: 3, rows: [] },
      to_invoice: { scope: 'own', count: 2, rows: [] },
    }));
    comp = build();
    comp.ngOnInit();

    expect(comp.pendingTotal()).toBe(5);
  });

  it("n'affiche aucune file quand le serveur n'en renvoie aucune", () => {
    getWorkQueues.mockReturnValue(of({}));
    comp = build();
    comp.ngOnInit();

    expect(comp.hasAnyQueue()).toBe(false);
    expect(comp.pendingTotal()).toBe(0);
  });

  it('nomme la portee telle que le serveur la rapporte', () => {
    comp = build();

    expect(comp.scopeLabel('own')).toBe('Mes lignes');
    expect(comp.scopeLabel('all')).toBe('Toute l’agence');
    expect(comp.scopeLabel(undefined)).toBe('Mes lignes');
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

  it('expose le detail technique quand le chargement echoue', () => {
    getWorkQueues.mockReturnValue(throwError(() => ({ url: '/api/work-queues', status: 503 })));
    comp = build();
    comp.ngOnInit();

    expect(comp.loadError()).toContain('/api/work-queues');
    expect(comp.loadError()).toContain('503');
    expect(comp.loading()).toBe(false);
  });
});
