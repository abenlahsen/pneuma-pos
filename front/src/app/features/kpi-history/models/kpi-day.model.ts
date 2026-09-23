import { KpiSnapshot } from './kpi-history.model';

/**
 * Une ligne de la liste des jours — refonte 2b, 9c.
 *
 * La liste n'affiche pas les instantanés : elle affiche les JOURS, et dit pour
 * chacun ce qu'on en sait. Un trou dans les dates doit se voir, et surtout se
 * qualifier — les deux causes d'absence n'appellent pas la même réaction :
 *
 *   'snapshot' — l'instantané existe, la ligne porte ses chiffres.
 *   'closed'   — boutique fermée ce jour-là (dimanche, férié). Normal.
 *   'missing'  — jour ouvré SANS instantané. La tâche planifiée de 00:05 n'a
 *                pas tourné : c'est une panne, et elle doit se voir.
 */
export type KpiDayKind = 'snapshot' | 'closed' | 'missing';

export interface KpiDay {
  /** `YYYY-MM-DD`. */
  date: string;
  kind: KpiDayKind;
  /** Présent uniquement pour `kind === 'snapshot'`. */
  snapshot: KpiSnapshot | null;
}
