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

/** Une file absente = l'utilisateur n'a pas la permission de la voir. */
export interface WorkQueues {
  unpaid?: WorkQueue<UnpaidRow>;
  to_invoice?: WorkQueue<ToInvoiceRow>;
}
