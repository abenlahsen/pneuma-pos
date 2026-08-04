import { PurchasesPageComponent } from './purchases-page.component';
import { Purchase } from '../models/purchase.model';

describe('PurchasesPageComponent', () => {
  let comp: PurchasesPageComponent;

  beforeEach(() => {
    // Bypasses the constructor (several injected services + inject()-based
    // fields) since statusOptionsFor() is a pure method that only reads its
    // argument and the imported PURCHASE_STATUS_TRANSITIONS constant.
    comp = Object.create(PurchasesPageComponent.prototype);
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
