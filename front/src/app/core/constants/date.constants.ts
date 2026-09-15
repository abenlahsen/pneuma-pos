/**
 * Manipulation de jours calendaires, en `YYYY-MM-DD`.
 *
 * Aucune locale française n'est enregistrée dans l'application (`LOCALE_ID`
 * vaut `en-US`), donc `| date:'EEEE'` rendrait « Sunday ». La convention
 * maison est un tableau français en dur — il existait déjà, dupliqué, dans
 * trois pages pour les mois. Celui-ci est le premier partagé.
 *
 * Toutes les fonctions travaillent sur des chaînes et construisent leurs
 * `Date` par composants (`new Date(y, m, d)`), jamais par analyse d'une
 * chaîne : `new Date('2026-09-15')` est interprété en UTC et recule d'un jour
 * dès qu'on est à l'ouest de Greenwich. C'est la même règle que `minutesOf()`
 * dans le planning d'atelier.
 */
export const WEEKDAYS_FR = [
  'dimanche',
  'lundi',
  'mardi',
  'mercredi',
  'jeudi',
  'vendredi',
  'samedi',
] as const;

/** Aujourd'hui dans le fuseau du poste, jamais en UTC. */
export function todayIso(): string {
  return toIso(new Date());
}

/** Décale d'un nombre de jours ; les débordements de mois et d'année sont gérés par `Date`. */
export function shiftDays(iso: string, days: number): string {
  const date = parse(iso);
  date.setDate(date.getDate() + days);

  return toIso(date);
}

/** Bornes de la semaine contenant ce jour, du lundi au dimanche. */
export function isoWeekBounds(iso: string): { from: string; to: string } {
  // getDay() rend 0 pour dimanche : on le ramène en fin de semaine, pas au début.
  const offset = (parse(iso).getDay() + 6) % 7;
  const from = shiftDays(iso, -offset);

  return { from, to: shiftDays(from, 6) };
}

/** « dimanche 13/09 » — pour une phrase. */
export function dayLabel(iso: string): string {
  const date = parse(iso);

  return `${WEEKDAYS_FR[date.getDay()]} ${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

/** « Lundi 07/09 » — pour une ligne autonome. */
export function shortDayLabel(iso: string): string {
  const label = dayLabel(iso);

  return label.charAt(0).toUpperCase() + label.slice(1);
}

function parse(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);

  return new Date(year, month - 1, day);
}

function toIso(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${date.getFullYear()}-${month}-${day}`;
}
