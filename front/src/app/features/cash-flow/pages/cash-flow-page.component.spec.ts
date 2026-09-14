import { buildBalanceCurve } from './balance-curve';

/**
 * Courbe de solde quotidien (`3g`).
 *
 * Le solde d'une journee, c'est celui du DERNIER mouvement de la journee —
 * pas la somme des mouvements, pas le premier. Et la courbe n'a de sens que
 * sur un compte donne : melanger deux comptes produirait une ligne en dents
 * de scie qui ne represente rien.
 */
describe('buildBalanceCurve', () => {
  const at = (date: string, balance: number | null) => ({ date, balance_after: balance });

  it('ne trace rien sans mouvement', () => {
    expect(buildBalanceCurve([])).toEqual([]);
  });

  it('retient le solde du dernier mouvement de chaque journee', () => {
    const curve = buildBalanceCurve([
      at('2026-03-01', 1500),
      at('2026-03-01', 1200), // plus tard le meme jour
      at('2026-03-02', 1800),
    ]);

    expect(curve).toEqual([
      { date: '2026-03-01', balance: 1200 },
      { date: '2026-03-02', balance: 1800 },
    ]);
  });

  it('remet les journees dans l ordre chronologique', () => {
    const curve = buildBalanceCurve([
      at('2026-03-05', 900),
      at('2026-03-01', 1500),
      at('2026-03-03', 1100),
    ]);

    expect(curve.map((p) => p.date)).toEqual(['2026-03-01', '2026-03-03', '2026-03-05']);
  });

  it('ignore les mouvements sans solde calcule', () => {
    const curve = buildBalanceCurve([at('2026-03-01', null), at('2026-03-02', 800)]);

    expect(curve).toEqual([{ date: '2026-03-02', balance: 800 }]);
  });

  it('ne garde que les N derniers jours', () => {
    const days = Array.from({ length: 40 }, (_, i) =>
      at(`2026-03-${String(i + 1).padStart(2, '0')}`, 100 + i),
    );

    const curve = buildBalanceCurve(days, 30);

    expect(curve).toHaveLength(30);
    expect(curve[0].date).toBe('2026-03-11');
  });
});

describe('buildBalanceCurve — trace SVG', () => {
  it('ne produit aucun trace sous deux points : une ligne demande deux points', () => {
    const { polyline } = buildBalanceCurve.toSvg([{ date: '2026-03-01', balance: 100 }], 900, 120);
    expect(polyline).toBe('');
  });

  it('etale les points sur toute la largeur', () => {
    const { polyline } = buildBalanceCurve.toSvg(
      [
        { date: '2026-03-01', balance: 0 },
        { date: '2026-03-02', balance: 100 },
      ],
      900,
      120,
    );

    const points = polyline.split(' ').map((p) => p.split(','));
    expect(Number(points[0][0])).toBe(0);
    expect(Number(points[points.length - 1][0])).toBe(900);
  });

  it('place le plus haut solde en haut et le plus bas en bas', () => {
    const { polyline } = buildBalanceCurve.toSvg(
      [
        { date: '2026-03-01', balance: 50 },
        { date: '2026-03-02', balance: 150 },
      ],
      900,
      120,
    );

    const [first, second] = polyline.split(' ').map((p) => Number(p.split(',')[1]));
    expect(second).toBeLessThan(first);
  });

  it('trace une ligne plate quand le solde ne bouge pas, sans diviser par zero', () => {
    const { polyline } = buildBalanceCurve.toSvg(
      [
        { date: '2026-03-01', balance: 100 },
        { date: '2026-03-02', balance: 100 },
      ],
      900,
      120,
    );

    const ys = polyline.split(' ').map((p) => Number(p.split(',')[1]));
    expect(ys.every((y) => Number.isFinite(y))).toBe(true);
    expect(new Set(ys).size).toBe(1);
  });
});
