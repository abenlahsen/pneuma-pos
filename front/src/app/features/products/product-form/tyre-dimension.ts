/**
 * Analyse d'une dimension de pneu saisie d'un trait — refonte 2b, gabarit 15a.
 *
 * Le métier dit « 205/55R16 91V » d'une seule phrase ; le formulaire en faisait
 * cinq champs numériques. L'analyse se fait ici, à la frappe, et n'écrit dans
 * les cinq champs du modèle que lorsqu'elle aboutit — ceux-ci ne changent pas.
 *
 * Trois écritures acceptées :
 *   205/55R16 91V     forme complète
 *   205/55R16         sans les indices
 *   2055516           abrégé du comptoir (largeur 3, hauteur 2, jante le reste)
 *
 * Les poids lourds écrivent des décimales (8.5R17.5, 295/80R22.5) : la largeur
 * et le diamètre les acceptent donc.
 */
export interface TyreDimension {
  width: number;
  height: number | null;
  diameter: number;
  loadIndex: string;
  speedIndex: string;
}

/** `205/55R16 91V`, `8.5R17.5`, avec ou sans indices. */
const WRITTEN = new RegExp(
  '^\\s*(\\d{1,3}(?:\\.\\d)?)' +      // largeur
  '(?:\\s*/\\s*(\\d{1,3}(?:\\.\\d)?))?' + // hauteur, facultative
  '\\s*[A-Z]{0,2}R\\s*(\\d{2,3}(?:\\.\\d)?)' + // jante
  '(?:\\s+(\\d{2,3})\\s*([A-Z]{1,2}))?\\s*$',  // charge + vitesse, facultatifs
  'i',
);

/** `2055516`, éventuellement suivi des indices : `2055516 91V`. */
const SHORTHAND = /^\s*(\d{7,8})(?:\s+(\d{2,3})\s*([A-Z]{1,2}))?\s*$/i;

export function parseTyreDimension(input: string): TyreDimension | null {
  const raw = (input ?? '').trim();
  if (!raw) return null;

  const written = WRITTEN.exec(raw);
  if (written) {
    return {
      width: Number(written[1]),
      height: written[2] ? Number(written[2]) : null,
      diameter: Number(written[3]),
      loadIndex: written[4] ?? '',
      speedIndex: (written[5] ?? '').toUpperCase(),
    };
  }

  const short = SHORTHAND.exec(raw);
  if (short) {
    const digits = short[1];
    return {
      width: Number(digits.slice(0, 3)),
      height: Number(digits.slice(3, 5)),
      diameter: Number(digits.slice(5)),
      loadIndex: short[2] ?? '',
      speedIndex: (short[3] ?? '').toUpperCase(),
    };
  }

  return null;
}

/** Recompose la saisie à partir des cinq champs, pour l'ouverture d'une fiche. */
export function formatTyreDimension(
  width: number | null,
  height: number | null,
  diameter: number | null,
  loadIndex?: string | null,
  speedIndex?: string | null,
): string {
  if (width == null || diameter == null) return '';

  const size = height != null ? `${width}/${height}R${diameter}` : `${width}R${diameter}`;
  const indices = `${loadIndex ?? ''}${speedIndex ?? ''}`.trim();

  return indices ? `${size} ${indices}` : size;
}
