/** Refonte 2b — palette de commandes (⌘K). */

export type PaletteKind = 'destination' | 'client' | 'sale' | 'service' | 'stock';

export interface PaletteResult {
  kind: PaletteKind;
  icon: string;
  label: string;
  /** Qualifiants affichés en sous-ligne : ville, date, quantité… */
  sub: string;
  route: string;
  queryParams?: Record<string, string>;
}

export interface PaletteGroup {
  kind: PaletteKind;
  title: string;
  results: PaletteResult[];
  /**
   * La source a échoué. On l'affiche au lieu de la taire : une palette qui
   * omet silencieusement les ventes laisse croire qu'il n'y en a aucune.
   */
  failed: boolean;
}

/**
 * Compare sans tenir compte des accents ni de la casse — « Réglages » se
 * trouve en tapant « reglages », ce qu'un clavier de comptoir rend courant.
 */
export function looseIncludes(haystack: string, needle: string): boolean {
  return fold(haystack).includes(fold(needle));
}

function fold(value: string): string {
  // NFD sépare la lettre de son accent ; \p{Diacritic} retire ensuite l'accent
  // seul. Écrit ainsi plutôt qu'avec une plage de caractères combinants, qui
  // serait invisible à la relecture du fichier.
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}
