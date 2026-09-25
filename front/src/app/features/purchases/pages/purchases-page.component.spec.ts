import { PurchasesPageComponent } from './purchases-page.component';
import { Purchase, PurchaseGroupRow } from '../models/purchase.model';

describe('PurchasesPageComponent', () => {
  let comp: PurchasesPageComponent;

  beforeEach(() => {
    // Bypasses the constructor (several injected services + inject()-based
    // fields) since statusOptionsFor() is a pure method that only reads its
    // argument and the imported PURCHASE_STATUS_TRANSITIONS constant.
    comp = Object.create(PurchasesPageComponent.prototype);
  });

  describe('ligne de liste — étape 11', () => {
    const row = (over: Partial<PurchaseGroupRow> = {}): PurchaseGroupRow =>
      ({ id: 1, days: 20, remaining: 1000, days_left: 10, ...over }) as PurchaseGroupRow;

    beforeEach(() => {
      (comp as any).oldDebtDays = 90;
    });

    it('écrit la réception en capitales accentuées', () => {
      expect(comp.receptionLabel('RECU')).toBe('REÇU');
      expect(comp.receptionLabel('TERMINE')).toBe('TERMINÉ');
    });

    it('fait primer le risque légal dans la sous-ligne du retard', () => {
      expect(comp.delayNote(row({ days: 126, days_left: -66 }))).toBe('> 90 j légal');
    });

    it('dit « réglé » quand rien ne reste dû, même ancien', () => {
      expect(comp.delayNote(row({ days: 200, remaining: 0 }))).toBe('réglé');
    });

    it('donne l’échéance contractuelle, ou son dépassement', () => {
      expect(comp.delayNote(row({ days_left: 30 }))).toBe('30 j restants');
      expect(comp.delayNote(row({ days_left: -4 }))).toBe('délai dépassé');
      expect(comp.delayNote(row({ days_left: null }))).toBeNull();
    });
  });

  describe('statusOptionsFor', () => {
    it('lists EN COURS transitions: current status first, then RECU/ANNULE', () => {
      const options = comp.statusOptionsFor({ status: 'EN COURS' } as Purchase);
      expect(options).toEqual(['EN COURS', 'RECU', 'ANNULE']);
    });

    it('never offers a direct jump from EN COURS to TERMINE', () => {
      const options = comp.statusOptionsFor({ status: 'EN COURS' } as Purchase);
      expect(options).not.toContain('TERMINE');
    });

    it('lists RECU transitions: current status first, then EN COURS/TERMINE', () => {
      const options = comp.statusOptionsFor({ status: 'RECU' } as Purchase);
      expect(options).toEqual(['RECU', 'EN COURS', 'TERMINE']);
    });

    it('restricts TERMINE to going back to RECU only', () => {
      const options = comp.statusOptionsFor({ status: 'TERMINE' } as Purchase);
      expect(options).toEqual(['TERMINE', 'RECU']);
    });

    it('treats ANNULE as a dead end: only EN COURS is offered', () => {
      const options = comp.statusOptionsFor({ status: 'ANNULE' } as Purchase);
      expect(options).toEqual(['ANNULE', 'EN COURS']);
      expect(options).not.toContain('TERMINE');
    });
  });
});
