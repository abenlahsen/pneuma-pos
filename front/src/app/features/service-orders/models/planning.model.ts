/** Planning de l'atelier (`3f`). */

export interface PlanningBay {
  id: number;
  name: string;
  technician: string | null;
}

export interface PlanningCard {
  id: number;
  client: string | null;
  vehicle: string | null;
  status: string;
  payment_status: string;
  amount: number;
  bay_id: number | null;
  /** `YYYY-MM-DD HH:mm` — l'interface n'a qu'a lire heures et minutes. */
  scheduled_at: string | null;
  duration_minutes: number | null;
}

export interface WorkshopPlanning {
  date: string;
  bays: PlanningBay[];
  scheduled: PlanningCard[];
  queue: PlanningCard[];
}
