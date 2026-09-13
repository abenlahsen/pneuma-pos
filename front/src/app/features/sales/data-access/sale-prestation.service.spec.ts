import { SalePrestationService } from './sale-prestation.service';
import { of } from 'rxjs';

describe('SalePrestationService', () => {
  let svc: SalePrestationService;
  let getSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    svc = Object.create(SalePrestationService.prototype);
    getSpy = vi.fn().mockReturnValue(of({ montage: null, alignment_vt: null, alignment_suv: null }));
    (svc as any).http = { get: getSpy };
    (svc as any).catalog$ = null;
  });

  describe('getCatalog', () => {
    it('calls http.get exactly once on multiple calls', () => {
      svc.getCatalog();
      svc.getCatalog();
      svc.getCatalog();
      expect(getSpy).toHaveBeenCalledTimes(1);
    });

    it('returns the same observable reference on repeated calls', () => {
      const first = svc.getCatalog();
      const second = svc.getCatalog();
      expect(first).toBe(second);
    });

    it('emits the catalog returned by the API', () => {
      let received: any = null;
      svc.getCatalog().subscribe(v => (received = v));
      expect(received).toEqual({ montage: null, alignment_vt: null, alignment_suv: null });
    });
  });
});
