/**
 * Un filtre actuellement appliqué à une liste, décrit de façon à pouvoir être
 * *nommé* puis *retiré* — refonte 2b, §14c état 2 (« liste vide après filtrage »).
 *
 * Les pages tiennent leurs filtres dans des signals séparés, qui savent
 * seulement leur valeur. Pour écrire « 3 filtres sont actifs : septembre 2026,
 * K. Amrani, non payé » et proposer de les retirer un par un, il faut en plus
 * un libellé lisible et le geste de retrait. C'est tout ce que porte ce type.
 */
export interface ActiveFilter {
  /** Libellé lisible, tel qu'il s'affiche : « non payé », « K. Amrani ». */
  label: string;

  /** Retire ce filtre-là (et relance le chargement de la liste). */
  clear: () => void;
}
