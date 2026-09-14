/**
 * Le ton d'un badge d'état — la règle du système, écrite une seule fois.
 *
 * Deux tons, et rien d'autre dans toute l'application. Le vert disparaît : un
 * état normal n'a pas besoin d'être signalé, seul l'anormal l'est. C'est ce
 * qui fait ressortir les cinq impayés d'une liste de trente-sept ventes.
 *
 * Ces deux fonctions remplacent huit méthodes `…Class()` qui renvoyaient un
 * nom de classe CSS depuis six composants différents.
 */
export type Tone = 'neutral' | 'alert';

/**
 * Un impayé ou un paiement partiel coûte quelque chose : il passe en alerte.
 *
 * Liste explicite plutôt que « tout sauf PAYE » : un statut absent ou inconnu
 * n'est pas un impayé, et on ne crie pas sur une inconnue.
 */
export function paymentTone(status: string | null | undefined): Tone {
  const value = (status ?? '').trim().toUpperCase();

  return value === 'NON PAYE' || value === 'PARTIEL' ? 'alert' : 'neutral';
}

/**
 * Seule l'annulation — ou le refus, pour une demande d'échange — mérite
 * l'alerte. « En cours », « Livrée », « Terminée » sont des états lus.
 */
export function statusTone(status: string | null | undefined): Tone {
  const value = (status ?? '').trim().toUpperCase();

  return value === 'ANNULE' || value === 'ANNULEE' || value === 'REFUSEE'
    ? 'alert'
    : 'neutral';
}
