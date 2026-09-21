import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';

import { ClientDetailPageComponent } from './client-detail-page.component';
import { ClientService } from '../data-access/client.service';
import { VehicleService } from '../../vehicles/data-access/vehicle.service';
import { AuthService } from '../../../core/services/auth.service';
import { ClientStatementResponse } from '../models/client.model';

/** Une date vieille de `days` jours, au format que renvoie l'API. */
function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Relevé de test : deux factures encore dues d'âges différents, une soldée,
 * un paiement sur chacune des deux premières, plus un solde d'ouverture.
 */
function statement(): ClientStatementResponse {
  return {
    client: { id: 1, name: 'Garage Atlas' },
    summary: { outstanding_balance: 900, total_purchased: 3000, total_paid: 2100 },
    sales: [
      { id: 10, type: 'sale', sale_date: daysAgo(12), total_amount: 500, balance_due: 400 },
      { id: 20, type: 'sale', sale_date: daysAgo(120), total_amount: 600, balance_due: 500 },
      { id: 30, type: 'sale', sale_date: daysAgo(200), total_amount: 900, balance_due: 0 },
      // Un ordre de service dû : le serveur l'exclut de l'ancienneté, nous aussi.
      { id: 40, type: 'service_order', sale_date: daysAgo(45), total_amount: 300, balance_due: 300 },
    ],
    payments: [],
    entries: [
      { type: 'payment', date: daysAgo(5), description: 'Paiement vente #10', sale_id: 10, payment_id: 77, debit: 0, credit: 100, balance: 900 },
      { type: 'sale', date: daysAgo(12), description: 'Vente #10', sale_id: 10, debit: 500, credit: 0, balance: 1000 },
      { type: 'payment', date: daysAgo(100), description: 'Paiement vente #20', sale_id: 20, payment_id: 78, debit: 0, credit: 100, balance: 500 },
      { type: 'sale', date: daysAgo(120), description: 'Vente #20', sale_id: 20, debit: 600, credit: 0, balance: 600 },
      { type: 'sale', date: daysAgo(200), description: 'Vente #30', sale_id: 30, debit: 900, credit: 0, balance: 0 },
      { type: 'opening_balance', date: daysAgo(400), description: "Solde d'ouverture", debit: 0, credit: 0, balance: 0 },
    ],
  } as ClientStatementResponse;
}

describe('Fiche client 16a — le registre et ses deux filtres', () => {
  let comp: ClientDetailPageComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClientDetailPageComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: ActivatedRoute, useValue: { paramMap: of(new Map()), snapshot: { paramMap: new Map() } } },
        { provide: Router, useValue: { navigate: () => {} } },
        { provide: ClientService, useValue: {} },
        { provide: VehicleService, useValue: { getVehiclesForClient: () => of([]) } },
        { provide: AuthService, useValue: { hasPermission: () => true } },
      ],
    }).compileComponents();

    comp = TestBed.createComponent(ClientDetailPageComponent).componentInstance;
    comp.statement.set(statement());
  });

  describe('le registre unique', () => {
    it('montre toutes les écritures sans filtre, dans l’ordre du serveur', () => {
      expect(comp.visibleEntries().length).toBe(6);
      expect(comp.visibleEntries()[0].description).toBe('Paiement vente #10');
    });

    it('ne recalcule pas le solde : il vient du serveur', () => {
      expect(comp.visibleEntries().map((e) => e.balance)).toEqual([900, 1000, 500, 600, 0, 0]);
    });
  });

  describe('les filtres de vue', () => {
    it('« en cours » ne garde que ce qui se rattache à une vente encore due', () => {
      comp.setScope('open');
      // ventes 10 et 20 et leurs paiements ; la 30 est soldée, l'ouverture n'a pas de vente
      expect(comp.visibleEntries().map((e) => e.sale_id)).toEqual([10, 10, 20, 20]);
    });

    it('« paiements » ne garde que les règlements', () => {
      comp.setScope('payments');
      expect(comp.visibleEntries().map((e) => e.payment_id)).toEqual([77, 78]);
    });

    it('compte les paiements pour l’étiquette du bouton', () => {
      expect(comp.paymentEntryCount()).toBe(2);
    });
  });

  describe("les tranches d'ancienneté", () => {
    it('filtre sur la tranche récente', () => {
      comp.toggleAgingBucket('0-30');
      expect(comp.visibleEntries().every((e) => e.sale_id === 10)).toBe(true);
      expect(comp.visibleEntries().length).toBe(2);
    });

    it('retient la facture ET ce qui a été versé dessus', () => {
      comp.toggleAgingBucket('90+');
      expect(comp.visibleEntries().map((e) => e.description))
        .toEqual(['Paiement vente #20', 'Vente #20']);
    });

    it('exclut les ordres de service, comme le fait le serveur', () => {
      // l'OS #40 a 45 jours : il tomberait dans 31-60 s'il était compté
      comp.toggleAgingBucket('31-60');
      expect(comp.visibleEntries()).toEqual([]);
    });

    it('un second clic sur la même tranche la désélectionne', () => {
      comp.toggleAgingBucket('0-30');
      comp.toggleAgingBucket('0-30');
      expect(comp.agingBucket()).toBeNull();
      expect(comp.visibleEntries().length).toBe(6);
    });

    it('se combine avec le filtre de vue', () => {
      comp.toggleAgingBucket('90+');
      comp.setScope('payments');
      expect(comp.visibleEntries().map((e) => e.payment_id)).toEqual([78]);
    });
  });

  describe('les repères visuels de la ligne', () => {
    it('marque en retard une écriture rattachée à une vente due', () => {
      const [payment, sale] = comp.visibleEntries();
      expect(comp.isOverdueEntry(sale)).toBe(true);
      expect(comp.isOverdueEntry(payment)).toBe(true);
    });

    it("n'affiche le nombre de jours que sur la dette, jamais sur un paiement", () => {
      const [payment, sale] = comp.visibleEntries();
      expect(comp.overdueDays(sale)).toBeGreaterThan(0);
      expect(comp.overdueDays(payment)).toBeNull();
    });

    it('ne marque pas une vente soldée', () => {
      const settled = comp.visibleEntries().find((e) => e.sale_id === 30)!;
      expect(comp.isOverdueEntry(settled)).toBe(false);
    });
  });

  describe('hasActiveFilter', () => {
    it('est faux au départ et vrai dès qu’un filtre est posé', () => {
      expect(comp.hasActiveFilter()).toBe(false);
      comp.setScope('open');
      expect(comp.hasActiveFilter()).toBe(true);
      comp.clearFilters();
      expect(comp.hasActiveFilter()).toBe(false);
    });
  });
});
