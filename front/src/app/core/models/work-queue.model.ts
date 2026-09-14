/** Files de travail de l'accueil (`5a`/`5b`). */

/**
 * Portee decidee et appliquee cote serveur.
 *  - `own`    : ses propres lignes ;
 *  - `all`    : celles de tout le monde, avec attribution ;
 *  - `shared` : rien a filtrer — l'information est d'agence et sans
 *               proprietaire (les produits sous seuil).
 */
export type QueueScope = 'own' | 'all' | 'shared';

/** Les trois files de l'accueil. Sert a nommer titres, badges et actions. */
export type QueueKey = 'unpaid' | 'to_invoice' | 'low_stock' | 'quotes';

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

/** Une ligne de la file « Devis sans réponse ». */
export interface QuoteRow {
  id: number;
  reference: string;
  client: string | null;
  commercial: string | null;
  issued_at: string | null;
  /** Jours ecoules depuis l'emission : c'est ce qui dit s'il est encore temps. */
  days_waiting: number;
  amount: number;
}

/** Une ligne de la file « Produits sous seuil ». */
export interface LowStockRow {
  product_id: number;
  reference: string | null;
  dimension: string | null;
  stock: number;
  threshold: number;
  /** Un lot existant : une ligne d'achat en exige un. */
  stock_id: number | null;
  /** Dernier prix paye pour cet article, pour amorcer le brouillon d'achat. */
  unit_price: number;
  /** Fournisseur du dernier achat non annule, quand il y en a un. */
  supplier_id: number | null;
}

export interface WorkQueue<TRow> {
  scope: QueueScope;
  /** Total cote serveur : `rows` n'en porte que les premieres. */
  count: number;
  /**
   * Montant de la file, sous la meme portee que les lignes. `null` pour la
   * file stock : elle compte des articles, elle n'a pas de montant.
   */
  total: number | null;
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
  today: { sales: number; revenue: number; margin: number; open_orders: number };
  /**
   * `agency_average` : moyenne du mois par commercial, pour se situer sans
   * voir personne. Null pour le gerant (il a le nominatif) et quand trop peu
   * de commerciaux sont actifs pour qu'une moyenne ne trahisse pas un collegue.
   */
  month: {
    revenue: number;
    margin: number;
    agency_average: number | null;
    /** Objectif mensuel personnel ; null = aucun objectif, donc aucune barre. */
    target: number | null;
  };
  /** Vide pour un commercial : il ne classe pas ses collegues. */
  ranking: RankingRow[];
  trend: TrendPoint[];
}

/** Une file absente = l'utilisateur n'a pas la permission de la voir. */
export interface WorkQueues {
  unpaid?: WorkQueue<UnpaidRow>;
  to_invoice?: WorkQueue<ToInvoiceRow>;
  low_stock?: WorkQueue<LowStockRow>;
  quotes?: WorkQueue<QuoteRow>;
  figures?: WorkFigures;
}
