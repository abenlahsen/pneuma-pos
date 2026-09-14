/**
 * Barres comparatives mois courant / mois precedent (`3h`).
 *
 * Une seule teinte porteuse de sens par graphique : le mois courant en encre,
 * le mois precedent en gris.
 *
 * Chaque paire est mise a l'echelle SUR ELLE-MEME, et non sur le maximum du
 * groupe. La question a laquelle ce graphique repond est « ce mois par rapport
 * au precedent », metrique par metrique — pas « quelle metrique est la plus
 * grande », qui n'aurait aucun sens entre des dirhams, des unites et un prix
 * moyen. Sur une echelle commune, « 58 pneus » a cote de « 113 545 DH »
 * s'ecrase a plat et la comparaison disparait.
 */
export interface ComparisonBar {
  label: string;
  current: number;
  previous: number;
  /** Hauteur en %, 0 a 100, relative au plus grand des deux mois. */
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

  return cards.map((c) => {
    // Valeurs absolues : une tresorerie negative doit se voir, pas
    // disparaitre sous l'axe. Le signe se lit sur la valeur, pas la hauteur.
    const max = Math.max(Math.abs(c.value), Math.abs(c.prev));

    return {
      label: c.label,
      current: c.value,
      previous: c.prev,
      // Paire a zero : des barres plates valent mieux qu'une division par zero.
      currentPct: max === 0 ? 0 : Math.round((Math.abs(c.value) / max) * 1000) / 10,
      previousPct: max === 0 ? 0 : Math.round((Math.abs(c.prev) / max) * 1000) / 10,
    };
  });
}
