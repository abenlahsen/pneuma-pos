/**
 * Une suppression en attente de confirmation — refonte 2b, gabarit 15c.
 *
 * Le geste destructeur est décrit ici puis exécuté plus tard, ce qui permet à
 * chaque écran de dire *ce que la suppression coûte* avant de la faire. Le
 * `run` capture l'objet visé par fermeture : un composant qui supprime
 * plusieurs sortes d'objets n'a donc pas besoin de les distinguer.
 */
export interface PendingDelete {
  /** Nomme l'objet, pas l'action : « Supprimer le lot Tanger · C-01 ? » */
  title: string;

  /** Ce que la suppression coûte, chiffré quand c'est chiffrable. */
  consequence?: string;

  /** Précision secondaire : trace écrite, irréversibilité, effet de bord. */
  detail?: string;

  confirmLabel?: string;

  /** Vrai seulement quand le serveur refuse la suppression sans motif. */
  reasonRequired?: boolean;

  /** Exécute la suppression. Reçoit le motif, vide s'il n'est pas demandé. */
  run: (reason: string) => void;
}
