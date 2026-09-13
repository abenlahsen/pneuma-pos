export interface ActiveFilter {
  label: string;
  value: string;
}

/**
 * Compose la phrase qui dit *pourquoi* une liste est vide, à partir des
 * filtres réellement actifs — c'est ce qui distingue un état vide utile d'un
 * « Aucun résultat » muet (`3b` du handoff).
 *
 *   describeActiveFilters([{ label: 'Statut', value: 'LIVRE' }])
 *   → 'Le filtre « Statut : LIVRE » est actif.'
 *
 * Les filtres sans valeur sont ignorés : un `<select>` laissé vide n'est pas
 * un filtre actif. Renvoie '' si aucun filtre ne l'est.
 */
export function describeActiveFilters(filters: ActiveFilter[]): string {
  const parts = filters
    .filter((f) => f.value?.trim())
    .map((f) => `« ${f.label} : ${f.value.trim()} »`);

  if (parts.length === 0) return '';
  if (parts.length === 1) return `Le filtre ${parts[0]} est actif.`;

  const last = parts[parts.length - 1];
  const head = parts.slice(0, -1).join(', ');

  return `Les filtres ${head} et ${last} sont actifs.`;
}
