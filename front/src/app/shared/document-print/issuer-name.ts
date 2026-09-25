/**
 * L'émetteur tel qu'il s'imprime sur les documents : « PNEU.MA SARL AU ».
 *
 * `legal_name` ne contient pas toujours la raison sociale complète : on y
 * trouve parfois la seule forme juridique (« SARL AU »), qui imprimée seule ne
 * désigne personne. Quand il ne contient pas déjà le nom commercial, on les
 * accole ; quand il le contient, il suffit.
 *
 * Partagé par la facture, le bon d'achat, la fiche d'intervention et la
 * lettre au transporteur.
 */
export function issuerNameOf(
  settings: { company_name?: string | null; legal_name?: string | null } | null | undefined,
): string {
  const company = (settings?.company_name ?? '').trim();
  const legal = (settings?.legal_name ?? '').trim();
  if (!legal) return company;
  if (!company || legal.toLowerCase().includes(company.toLowerCase())) return legal;
  return `${company} ${legal}`;
}
