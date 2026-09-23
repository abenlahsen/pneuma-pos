export interface PrimeRow {
  commercial_id: number | null;
  commercial_name: string;
  sale_tyres: number;
  so_tyres: number;
  total_tyres: number;
  prime_per_tyre: number;
  /** Ce qui est réellement dû : 0 tant que le seuil collectif n'est pas franchi. */
  prime_total: number;
}

export interface PrimeSummary {
  total_primes: number;
  total_commerciaux: number;
}

/**
 * Un jour du mois — refonte 2b, 9b.
 *
 * Tous les jours sont présents, zéros compris : l'écran lit la série comme un
 * calendrier, et un tableau creux laisserait un jour fermé passer pour un jour
 * manquant.
 */
export interface PrimeDay {
  date: string;
  sale_tyres: number;
  so_tyres: number;
  total_tyres: number;
}

/**
 * Un mois passé, avec le seuil qui s'appliquait alors.
 *
 * `prime_threshold` est nul pour un mois antérieur à la première ligne de
 * `prime_thresholds` : la table a commencé à compter le jour de sa création et
 * ne récupère rien d'avant. L'écran y affiche un tiret, sans verdict.
 */
export interface PrimeHistoryMonth {
  year: number;
  month: number;
  shop_total_tyres: number;
  prime_threshold: number | null;
}

export interface PrimesResponse {
  year: number;
  month: number;
  prime_threshold: number;
  shop_total_tyres: number;
  prime_eligible: boolean;
  summary: PrimeSummary;
  data: PrimeRow[];
  daily: PrimeDay[];
  /** Marge nette du mois, pour la part que coûte la prime. */
  net_margin: number;
  /** Les six mois précédents, du plus récent au plus ancien. */
  history: PrimeHistoryMonth[];
}
