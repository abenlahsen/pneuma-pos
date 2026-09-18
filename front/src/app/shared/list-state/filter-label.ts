/**
 * Met une date de filtre au format lisible dans une phrase française —
 * refonte 2b, §14c état 2.
 *
 * Les champs de filtre `<input type="date">` rendent « 2026-09-01 », qui n'a
 * rien à faire dans « à partir du … ». Aucune locale Angular n'étant
 * enregistrée dans l'application, le formatage se fait ici, à la main.
 */
export function frenchDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}
