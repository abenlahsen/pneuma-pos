/** Files de travail de l'accueil (`5a`/`5b`). */

/** Portee decidee et appliquee cote serveur : 'own' = ses propres lignes. */
export type QueueScope = 'own' | 'all';

export interface UnpaidRow {
  id: number;
  date: string;
  client: string | null;
  phone: string | null;
  commercial: string | null;
  amount: number;
  payment_status: string;
}

export interface ToInvoiceRow {
  id: number;
  date: string;
  vehicle: string | null;
  commercial: string | null;
  amount: number;
  payment_status: string;
}

export interface WorkQueue<TRow> {
  scope: QueueScope;
  /** Total cote serveur : `rows` n'en porte que les premieres. */
  count: number;
  rows: TRow[];
}

export interface RankingRow {
  id: number;
  name: string;
  revenue: number;
  /** L'impaye de chacun : un CA eleve avec un impaye eleve n'est pas une performance. */
  unpaid: number;
}

export interface TrendPoint {
  date: string;
  revenue: number;
}

/** Colonne laterale (`5a`/`5b`) — « mes chiffres » ou ceux de l'agence. */
export interface WorkFigures {
  scope: QueueScope;
  today: { sales: number; revenue: number };
  /**
   * `agency_average` : moyenne du mois par commercial, pour se situer sans
   * voir personne. Null pour le gerant (il a le nominatif) et quand trop peu
   * de commerciaux sont actifs pour qu'une moyenne ne trahisse pas un collegue.
   */
  month: { revenue: number; margin: number; agency_average: number | null };
  /** Vide pour un commercial : il ne classe pas ses collegues. */
  ranking: RankingRow[];
  trend: TrendPoint[];
}

/** Une file absente = l'utilisateur n'a pas la permission de la voir. */
export interface WorkQueues {
  unpaid?: WorkQueue<UnpaidRow>;
  to_invoice?: WorkQueue<ToInvoiceRow>;
  figures?: WorkFigures;
}
