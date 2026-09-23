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
 * L'API ne renvoie pas encore ce bloc : `prime_threshold` est une colonne
 * unique de `company_settings`, sans historique ni journal de ses changements,
 * donc le seuil d'un mois écoulé n'est nulle part. Le type est posé pour que le
 * panneau s'allume le jour où le backend saura le dire — il ne se simule pas.
 */
export interface PrimeHistoryMonth {
  year: number;
  month: number;
  shop_total_tyres: number;
  prime_threshold: number;
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
  history?: PrimeHistoryMonth[];
}
