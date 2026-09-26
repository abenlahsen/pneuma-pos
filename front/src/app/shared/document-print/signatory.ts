/**
 * Le signataire d'un document imprimé : « K. Amrani · commercial ».
 *
 * Les rôles Spatie sont en anglais (Administrator, Manager…) ; la signature
 * est en français. Partagé par la facture, le bon d'achat, la fiche
 * d'intervention et la lettre au transporteur, qui écrivait jusqu'ici
 * « administrator ».
 */
const ROLE_LABELS: Record<string, string> = {
  Administrator: 'administrateur',
  Manager: 'responsable',
  Commercial: 'commercial',
  Driver: 'chauffeur',
};

export function signatoryOf(
  person: { name?: string | null; role?: string | null } | null | undefined,
): string | null {
  const name = (person?.name ?? '').trim();
  if (!name) return null;
  const role = (person?.role ?? '').trim();
  if (!role) return name;
  return `${name} · ${ROLE_LABELS[role] ?? role.toLowerCase()}`;
}
