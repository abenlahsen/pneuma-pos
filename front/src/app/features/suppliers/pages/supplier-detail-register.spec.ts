import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';

import { SupplierDetailPageComponent } from './supplier-detail-page.component';
import { SupplierService } from '../data-access/supplier.service';
import { AuthService } from '../../../core/services/auth.service';
import { SupplierStatementResponse } from '../models/supplier.model';

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Relevé de test : trois achats d'âges différents, dont un soldé, un paiement
 * sur chacun des deux dus, et un remboursement de retour.
 */
function statement(): SupplierStatementResponse {
  return {
    supplier: { id: 1, name: 'SDTM', payment_terms_days: 60 },
    summary: {
      purchases_count: 3, payments_count: 2,
      total_purchased: 9000, total_paid: 2000,
      outstanding_balance: 7000, last_purchase_date: daysAgo(12),
    },
    purchases: [
      { id: 10, date: daysAgo(12), net_amount: 3000, paid_amount: 1000, outstanding_amount: 2000 },
      { id: 20, date: daysAgo(130), net_amount: 5000, paid_amount: 1000, outstanding_amount: 4000 },
      { id: 30, date: daysAgo(200), net_amount: 1000, paid_amount: 1000, outstanding_amount: 0 },
    ],
    payments: [
      { id: 77, purchase_id: 10, amount: 1000 },
      { id: 78, purchase_id: 20, amount: 1000 },
    ],
    entries: [
      { type: 'payment', date: daysAgo(5), description: 'Paiement #77', purchase_id: 10, payment_id: 77, debit: 0, credit: 1000, balance: 7000 },
      { type: 'purchase', date: daysAgo(12), description: 'Achat #10', purchase_id: 10, debit: 3000, credit: 0, balance: 8000 },
      { type: 'refund', date: daysAgo(40), description: 'Remboursement retour #3 — Achat #20', purchase_id: 20, debit: 500, credit: 0, balance: 5000 },
      { type: 'payment', date: daysAgo(100), description: 'Paiement #78', purchase_id: 20, payment_id: 78, debit: 0, credit: 1000, balance: 4500 },
      { type: 'purchase', date: daysAgo(130), description: 'Achat #20', purchase_id: 20, debit: 5000, credit: 0, balance: 5500 },
      { type: 'purchase', date: daysAgo(200), description: 'Achat #30', purchase_id: 30, debit: 1000, credit: 0, balance: 500 },
    ],
  } as SupplierStatementResponse;
}

/**
 * Fiche fournisseur 16a — miroir de la fiche client, avec deux différences qui
 * lui appartiennent : « Avoirs » existe ici, parce que les retours remboursés
 * sont de vraies écritures, et la dernière tranche d'ancienneté est le seuil de
 * risque légal à 90 jours, pas un simple retard.
 */
describe('SupplierDetailPageComponent — le registre 16a', () => {
  let comp: SupplierDetailPageComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SupplierDetailPageComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: ActivatedRoute, useValue: { paramMap: of(new Map()), snapshot: { paramMap: new Map() } } },
        { provide: Router, useValue: { navigate: () => {} } },
        { provide: SupplierService, useValue: {} },
        { provide: AuthService, useValue: { hasPermission: () => true } },
      ],
    }).compileComponents();

    comp = TestBed.createComponent(SupplierDetailPageComponent).componentInstance;
    comp.statement.set(statement());
  });

  describe('le registre unique', () => {
    it("montre toutes les écritures dans l'ordre du serveur", () => {
      expect(comp.visibleEntries().length).toBe(6);
      expect(comp.visibleEntries()[0].description).toBe('Paiement #77');
    });

    it('ne recalcule pas le solde progressif', () => {
      expect(comp.visibleEntries().map((e) => e.balance)).toEqual([7000, 8000, 5000, 4500, 5500, 500]);
    });
  });

  describe('les quatre vues', () => {
    it('« à régler » ne garde que ce qui se rattache à un achat encore dû', () => {
      comp.setScope('due');
      expect(comp.visibleEntries().map((e) => e.purchase_id)).toEqual([10, 10, 20, 20, 20]);
    });

    it('« paiements » ne garde que les règlements', () => {
      comp.setScope('payments');
      expect(comp.visibleEntries().map((e) => e.payment_id)).toEqual([77, 78]);
    });

    // Contrairement à la fiche client, « Avoirs » a des données ici.
    it('« avoirs » ne garde que les remboursements de retour', () => {
      comp.setScope('refunds');
      expect(comp.visibleEntries().length).toBe(1);
      expect(comp.visibleEntries()[0].type).toBe('refund');
    });

    it('compte séparément paiements et avoirs pour les étiquettes', () => {
      expect(comp.paymentEntryCount()).toBe(2);
      expect(comp.refundEntryCount()).toBe(1);
    });
  });

  describe("l'âge du règlement", () => {
    it('range chaque achat dû dans sa tranche, sur le montant restant', () => {
      const ag = comp.settlementAging();
      expect(ag.buckets['0-30']).toBe(2000);
      expect(ag.buckets['90+']).toBe(4000);
      expect(ag.buckets['31-60']).toBe(0);
      expect(ag.total).toBe(6000);
    });

    it('ignore un achat soldé', () => {
      // l'achat 30 a 200 jours mais ne doit rien : il ne pèse dans aucune tranche
      expect(comp.settlementAging().total).toBe(2000 + 4000);
    });

    it('filtre le registre sur la tranche cliquée', () => {
      comp.toggleBucket('0-30');
      expect(comp.visibleEntries().every((e) => e.purchase_id === 10)).toBe(true);
    });

    it('un second clic désélectionne', () => {
      comp.toggleBucket('90+');
      comp.toggleBucket('90+');
      expect(comp.bucket()).toBeNull();
      expect(comp.visibleEntries().length).toBe(6);
    });

    it('se combine avec la vue', () => {
      comp.toggleBucket('90+');
      comp.setScope('refunds');
      expect(comp.visibleEntries().map((e) => e.type)).toEqual(['refund']);
    });
  });

  describe('le seuil de risque légal', () => {
    it("n'est franchi que par un achat de plus de 90 jours encore dû", () => {
      const entries = comp.visibleEntries();
      const vieux = entries.find((e) => e.purchase_id === 20 && e.type === 'purchase')!;
      const recent = entries.find((e) => e.purchase_id === 10 && e.type === 'purchase')!;

      expect(comp.atLegalRisk(vieux)).toBe(true);
      expect(comp.atLegalRisk(recent)).toBe(false);
    });

    it('ne compte les jours que sur une ligne d’achat, jamais sur un paiement', () => {
      const paiement = comp.visibleEntries()[0];
      expect(comp.waitingDays(paiement)).toBeNull();
    });

    it("ne marque pas un achat soldé, même très ancien", () => {
      const solde = comp.visibleEntries().find((e) => e.purchase_id === 30)!;
      expect(comp.isDueEntry(solde)).toBe(false);
      expect(comp.atLegalRisk(solde)).toBe(false);
    });
  });

  describe('le retard le plus ancien', () => {
    it('se compte au-delà du délai contractuel, pas depuis la date d’achat', () => {
      // l'achat 20 a ~130 jours, le délai accordé est de 60 : ~70 jours de retard
      expect(comp.worstWaitingDays()).toBeGreaterThanOrEqual(69);
      expect(comp.worstWaitingDays()).toBeLessThanOrEqual(71);
    });

    /**
     * Le délai vient du relevé quand le profil n'est pas arrivé. Les deux
     * requêtes sont indépendantes et l'écran survit à l'échec de l'une : lire
     * le délai dans le seul profil ferait compter le retard depuis la date
     * d'achat, délai ignoré — c'est le défaut que ce test a trouvé.
     */
    it('lit le délai dans le relevé quand le profil manque', () => {
      expect(comp.profile()).toBeNull();
      expect(comp.contractualDays()).toBe(60);
    });

    it('vaut zéro quand aucun délai n’est renseigné', () => {
      comp.statement.update((st) => ({ ...st!, supplier: { id: 1, name: 'SDTM' } }));
      expect(comp.contractualDays()).toBe(0);
      // sans délai opposable, le retard se compte depuis l'achat lui-même
      expect(comp.worstWaitingDays()).toBeGreaterThanOrEqual(129);
    });
  });
});
