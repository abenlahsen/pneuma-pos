import { PrintService } from './print.service';
import { of } from 'rxjs';

describe('PrintService', () => {
  let svc: PrintService;
  let getCompanySettingsSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    svc = Object.create(PrintService.prototype);
    getCompanySettingsSpy = vi.fn().mockReturnValue(of({ name: 'Test Shop' }));
    (svc as any).settingsService = { getCompanySettings: getCompanySettingsSpy };
    (svc as any).settings$ = null;
  });

  describe('getSettings', () => {
    it('returns an observable', () => {
      const result = svc.getSettings();
      expect(result).toBeDefined();
      expect(typeof result.subscribe).toBe('function');
    });

    it('calls settingsService.getCompanySettings() exactly once on multiple calls', () => {
      svc.getSettings();
      svc.getSettings();
      svc.getSettings();
      expect(getCompanySettingsSpy).toHaveBeenCalledTimes(1);
    });

    it('returns the same observable reference on repeated calls', () => {
      const first = svc.getSettings();
      const second = svc.getSettings();
      expect(first).toBe(second);
    });

    it('emits the value from the underlying service', () => {
      let received: any = null;
      svc.getSettings().subscribe(v => (received = v));
      expect(received).toEqual({ name: 'Test Shop' });
    });
  });
});
