import { PrintService, PdfUnit, paginate } from './print.service';
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

/**
 * Refonte 2b, 10a — la pagination du PDF. Le contenu mesure 1000 px ; une page
 * utile en contient 300. Les lignes du tableau font 40 px, l'en-tête 20 px.
 */
describe('paginate', () => {
  const block = (top: number, bottom: number): PdfUnit => ({ top, bottom, isRow: false });
  const row = (top: number): PdfUnit => ({ top, bottom: top + 40, isRow: true });

  it('garde tout sur une page quand tout tient', () => {
    expect(paginate([block(0, 100), block(100, 250)], 250, 300, null))
      .toEqual([{ start: 0, end: 250, repeatHead: false }]);
  });

  it('ne coupe jamais une ligne : la page s’arrête avant celle qui déborderait', () => {
    // en-tête de document 0-100, en-tête du tableau 100-120, lignes à partir de 120.
    const units = [block(0, 100), row(120), row(160), row(200), row(240), row(280), row(320)];
    const slices = paginate(units, 360, 300, { top: 100, bottom: 120 });

    // La ligne 280-320 dépasserait 300 : elle ouvre la page 2.
    expect(slices[0]).toEqual({ start: 0, end: 280, repeatHead: false });
    expect(slices[1]).toEqual({ start: 280, end: 360, repeatHead: true });
    for (const u of units) {
      const inside = slices.some(s => u.top >= s.start && u.bottom <= s.end);
      expect(inside).toBe(true);
    }
  });

  it('réserve la hauteur de l’en-tête répété sur les pages suivantes', () => {
    // Page 2 commence à 280 : 280 + 20 (en-tête) de place utilisée pour 300.
    const units = [block(0, 100)];
    for (let top = 120; top < 900; top += 40) units.push(row(top));
    const slices = paginate(units, 900, 300, { top: 100, bottom: 120 });

    for (const s of slices) {
      const used = s.end - s.start + (s.repeatHead ? 20 : 0);
      expect(used).toBeLessThanOrEqual(300);
    }
    expect(slices.slice(1).every(s => s.repeatHead)).toBe(true);
  });

  it('fait passer la clôture entière sur la page suivante', () => {
    const units = [block(0, 100), row(120), row(160), block(200, 420)];
    const slices = paginate(units, 420, 300, { top: 100, bottom: 120 });

    expect(slices).toEqual([
      { start: 0, end: 200, repeatHead: false },
      { start: 200, end: 420, repeatHead: false },
    ]);
  });

  it('ne laisse pas l’en-tête du tableau seul en bas d’une page', () => {
    // Le bloc du haut va jusqu'à 260 ; l'en-tête 260-280 tiendrait, la
    // première ligne 280-320 non. La coupure remonte au-dessus de l'en-tête.
    const units = [block(0, 260), row(280), row(320)];
    const slices = paginate(units, 360, 300, { top: 260, bottom: 280 });

    expect(slices).toEqual([
      { start: 0, end: 260, repeatHead: false },
      { start: 260, end: 360, repeatHead: false },
    ]);
  });

  it('tranche de force un bloc plus haut qu’une page au lieu de boucler', () => {
    const slices = paginate([block(0, 700)], 700, 300, null);
    expect(slices).toEqual([
      { start: 0, end: 300, repeatHead: false },
      { start: 300, end: 600, repeatHead: false },
      { start: 600, end: 700, repeatHead: false },
    ]);
  });
});
