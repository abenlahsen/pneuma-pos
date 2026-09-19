import { formatTyreDimension, parseTyreDimension } from './tyre-dimension';

/** Refonte 2b, gabarit 15a — la dimension saisie d'un trait. */

describe('parseTyreDimension', () => {
  it('lit la forme complète', () => {
    expect(parseTyreDimension('205/55R16 91V')).toEqual({
      width: 205,
      height: 55,
      diameter: 16,
      loadIndex: '91',
      speedIndex: 'V',
    });
  });

  it('lit la forme sans les indices', () => {
    const dim = parseTyreDimension('205/55R16');

    expect(dim?.width).toBe(205);
    expect(dim?.diameter).toBe(16);
    expect(dim?.loadIndex).toBe('');
  });

  it('lit l\'abrégé du comptoir', () => {
    expect(parseTyreDimension('2055516')).toEqual({
      width: 205,
      height: 55,
      diameter: 16,
      loadIndex: '',
      speedIndex: '',
    });
  });

  it('accepte les indices après l\'abrégé', () => {
    const dim = parseTyreDimension('2055516 91V');

    expect(dim?.loadIndex).toBe('91');
    expect(dim?.speedIndex).toBe('V');
  });

  /** Le poids lourd écrit des décimales : 8.5R17.5, 295/80R22.5. */
  it('accepte les décimales du poids lourd', () => {
    expect(parseTyreDimension('295/80R22.5')?.diameter).toBe(22.5);
    expect(parseTyreDimension('8.5R17.5')?.width).toBe(8.5);
  });

  it('laisse la hauteur vide quand elle est absente', () => {
    expect(parseTyreDimension('8.5R17.5')?.height).toBeNull();
  });

  it('met l\'indice de vitesse en majuscule', () => {
    expect(parseTyreDimension('205/55r16 91v')?.speedIndex).toBe('V');
  });

  it('tolère les espaces autour', () => {
    expect(parseTyreDimension('  205/55R16  ')?.width).toBe(205);
  });

  it('refuse ce qui n\'est pas une dimension, plutôt que de deviner', () => {
    expect(parseTyreDimension('michelin')).toBeNull();
    expect(parseTyreDimension('')).toBeNull();
    expect(parseTyreDimension('1108')).toBeNull();
  });
});

describe('formatTyreDimension', () => {
  it('recompose la saisie depuis les cinq champs', () => {
    expect(formatTyreDimension(205, 55, 16, '91', 'V')).toBe('205/55R16 91V');
  });

  it('omet la hauteur quand elle manque', () => {
    expect(formatTyreDimension(8.5, null, 17.5, '', '')).toBe('8.5R17.5');
  });

  it('rend une chaîne vide sans largeur ni jante', () => {
    expect(formatTyreDimension(null, 55, null)).toBe('');
  });

  it('fait l\'aller-retour sans rien perdre', () => {
    const dim = parseTyreDimension('205/55R16 91V')!;

    expect(formatTyreDimension(dim.width, dim.height, dim.diameter, dim.loadIndex, dim.speedIndex))
      .toBe('205/55R16 91V');
  });
});
