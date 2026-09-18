import { HttpErrorResponse } from '@angular/common/http';

/**
 * Traduit une erreur HTTP en une cause lisible et un détail technique —
 * refonte 2b, §14c état 3.
 *
 * Les six écrans de liste partagent ce vocabulaire pour qu'une panne dise la
 * même chose partout : la cause est une phrase ponctuée, affichée telle quelle ;
 * le détail reste replié.
 */
export interface LoadErrorInfo {
  cause: string;
  detail: string;
}

export function describeLoadError(error: unknown): LoadErrorInfo {
  const response = error instanceof HttpErrorResponse ? error : null;
  const status = response?.status ?? 0;

  let cause: string;
  if (response === null) {
    // Ni le réseau ni le serveur : une erreur levée côté navigateur. Dire
    // « le serveur n'a pas répondu » enverrait chercher la panne au mauvais endroit.
    cause = 'La requête a échoué.';
  } else if (status === 0) {
    cause = "Le serveur n'a pas répondu.";
  } else if (status === 401) {
    cause = 'Votre session a expiré.';
  } else if (status === 403) {
    cause = "Votre rôle n'autorise pas la consultation de cette liste.";
  } else if (status === 404) {
    cause = "L'adresse demandée n'existe pas.";
  } else if (status === 422) {
    cause = "Un filtre a été refusé par le serveur.";
  } else if (status >= 500) {
    cause = 'Le serveur a rencontré une erreur.';
  } else {
    cause = 'La requête a échoué.';
  }

  const serverMessage =
    typeof response?.error === 'object' && response?.error !== null && 'message' in response.error
      ? String((response.error as { message: unknown }).message)
      : null;

  const detail = [
    response ? `HTTP ${status} ${response.statusText || ''}`.trim() : 'Erreur inattendue',
    response?.url ?? null,
    serverMessage,
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n');

  return { cause, detail };
}
