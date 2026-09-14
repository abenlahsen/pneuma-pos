/**
 * Barres comparatives mois courant / mois precedent (`3h`).
 *
 * Une seule teinte porteuse de sens par graphique : le mois courant en encre,
 * le mois precedent en gris. Les hauteurs sont relatives au plus grand des
 * deux, sur l'ensemble du groupe — comparer des barres dont chacune a sa
 * propre echelle ne voudrait rien dire.
 */
export interface ComparisonBar {
  label: string;
  current: number;
  previous: number;
  /** Hauteur en %, 0 a 100, relative au maximum du groupe. */
  currentPct: number;
  previousPct: number;
}

interface CardLike {
  label: string;
  value: number;
  prev: number;
}

export function buildComparisonBars(cards: CardLike[]): ComparisonBar[] {
  if (cards.length === 0) return [];

  // L'echelle est commune au groupe, et prend les valeurs absolues :
  // une tresorerie negative doit se voir, pas disparaitre sous l'axe.
  const max = Math.max(...cards.flatMap((c) => [Math.abs(c.value), Math.abs(c.prev)]));

  return cards.map((c) => ({
    label: c.label,
    current: c.value,
    previous: c.prev,
    // Tout a zero : des barres plates valent mieux qu'une division par zero.
    currentPct: max === 0 ? 0 : Math.round((Math.abs(c.value) / max) * 1000) / 10,
    previousPct: max === 0 ? 0 : Math.round((Math.abs(c.prev) / max) * 1000) / 10,
  }));
}
