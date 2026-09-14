/** Un point de la courbe de solde quotidien (`3g`). */
export interface BalancePoint {
  date: string;
  balance: number;
}

interface MovementLike {
  date: string;
  balance_after?: number | null;
}

/**
 * Construit la courbe de solde quotidien a partir des mouvements.
 *
 * Le solde d'une journee est celui de son DERNIER mouvement — pas la somme
 * des mouvements du jour, pas le premier. Les mouvements arrivent tries par
 * date decroissante ; on les remet dans l'ordre et on ne garde que la fin de
 * chaque journee.
 *
 * La courbe n'a de sens que sur UN compte : melanger deux comptes donnerait
 * une ligne en dents de scie qui ne represente rien. C'est l'appelant qui
 * garantit ce filtre.
 */
export function buildBalanceCurve(movements: MovementLike[], days = 30): BalancePoint[] {
  const lastOfDay = new Map<string, number>();

  for (const m of [...movements].sort((a, b) => a.date.localeCompare(b.date))) {
    if (m.balance_after == null) continue;
    lastOfDay.set(m.date.slice(0, 10), m.balance_after);
  }

  const points = [...lastOfDay.entries()]
    .map(([date, balance]) => ({ date, balance }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return points.slice(-days);
}

/**
 * Projette la courbe en coordonnees SVG. Le trace est en encre : une seule
 * polyligne, pas d'aplat ni de degrade.
 */
buildBalanceCurve.toSvg = (points: BalancePoint[], width: number, height: number): { polyline: string } => {
  if (points.length < 2) return { polyline: '' };

  const values = points.map((p) => p.balance);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;

  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1)) * width;
    // Solde constant : on trace a mi-hauteur plutot que de diviser par zero.
    const y = span === 0 ? height / 2 : height - ((p.balance - min) / span) * height;
    return `${Math.round(x * 100) / 100},${Math.round(y * 100) / 100}`;
  });

  return { polyline: coords.join(' ') };
};
