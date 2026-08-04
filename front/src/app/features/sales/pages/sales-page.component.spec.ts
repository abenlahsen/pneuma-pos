import { SalesPageComponent } from './sales-page.component';
import { Sale } from '../models/sale.model';

describe('SalesPageComponent', () => {
  let comp: SalesPageComponent;

  beforeEach(() => {
    // Bypasses the constructor (several injected services + inject()-based
    // fields) since statusOptionsFor() is a pure method that only reads its
    // argument and the imported SALE_STATUS_TRANSITIONS constant.
    comp = Object.create(SalesPageComponent.prototype);
  });

  describe('statusOptionsFor', () => {
    it('lists EN COURS transitions: current status first, then LIVRE/MONTE/ANNULE', () => {
      const options = comp.statusOptionsFor({ status: 'EN COURS' } as Sale);
      expect(options).toEqual(['EN COURS', 'LIVRE', 'MONTE', 'ANNULE']);
    });

    it('never offers a direct jump from EN COURS to TERMINEE', () => {
      const options = comp.statusOptionsFor({ status: 'EN COURS' } as Sale);
      expect(options).not.toContain('TERMINEE');
    });

    it('lists LIVRE transitions: current status first, then EN COURS/MONTE/TERMINEE', () => {
      const options = comp.statusOptionsFor({ status: 'LIVRE' } as Sale);
      expect(options).toEqual(['LIVRE', 'EN COURS', 'MONTE', 'TERMINEE']);
    });

    it('allows the lateral move from LIVRE to MONTE', () => {
      const options = comp.statusOptionsFor({ status: 'LIVRE' } as Sale);
      expect(options).toContain('MONTE');
    });

    it('restricts TERMINEE to going back to LIVRE or MONTE only', () => {
      const options = comp.statusOptionsFor({ status: 'TERMINEE' } as Sale);
      expect(options).toEqual(['TERMINEE', 'LIVRE', 'MONTE']);
    });

    it('treats ANNULE as a dead end: only EN COURS is offered', () => {
      const options = comp.statusOptionsFor({ status: 'ANNULE' } as Sale);
      expect(options).toEqual(['ANNULE', 'EN COURS']);
      expect(options).not.toContain('TERMINEE');
    });
  });
});
