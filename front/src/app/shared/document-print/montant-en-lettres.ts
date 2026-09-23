/**
 * Un montant en toutes lettres, en français — refonte 2b, 10a.
 *
 * C'est une mention comptable : sur une facture, elle fait foi en cas de
 * litige sur le chiffre. Les accords doivent donc être justes, et ils sont la
 * seule vraie difficulté du français ici.
 *
 * Trois règles, et leurs exceptions :
 *
 *   « vingt » et « cent » prennent un s quand ils sont MULTIPLIÉS et que rien
 *   ne les suit — quatre-vingts, deux cents. Suivis d'un autre mot de nombre,
 *   ils le perdent : quatre-vingt-un, deux cent trois.
 *
 *   « mille » est invariable, toujours. Et comme c'est un mot de NOMBRE, il
 *   fait tomber le s de ce qui le précède : deux cent mille, quatre-vingt
 *   mille.
 *
 *   « million » et « milliard » sont des NOMS, pas des mots de nombre. Ils
 *   s'accordent eux-mêmes (deux millions) et laissent le s à ce qui les
 *   précède : deux cents millions.
 *
 * C'est cette dernière distinction — mille d'un côté, million de l'autre —
 * qui justifie le paramètre `final` promené dans tout le fichier.
 */

const UNITES = [
  'zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
  'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize',
  'dix-sept', 'dix-huit', 'dix-neuf',
];

const DIZAINES = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante'];

/**
 * 0 à 99.
 *
 * @param final Rien ne suit ce groupe, ou bien c'est un nom (million,
 *   milliard) : « quatre-vingts » garde son s. Faux devant « mille ».
 */
function deuxChiffres(n: number, final: boolean): string {
  if (n < 20) return UNITES[n];

  const d = Math.floor(n / 10);
  const u = n % 10;

  // 70-79 et 90-99 se disent « soixante-dix » et « quatre-vingt-dix » : la
  // dizaine reste 60 ou 80 et l'unité monte jusqu'à 19.
  if (d === 7 || d === 9) {
    const base = d === 7 ? 'soixante' : 'quatre-vingt';
    // Le « et » ne survit qu'à soixante et onze ; quatre-vingt-onze n'en a pas.
    if (d === 7 && u === 1) return 'soixante et onze';
    return `${base}-${UNITES[10 + u]}`;
  }

  if (d === 8) {
    if (u === 0) return final ? 'quatre-vingts' : 'quatre-vingt';
    // Pas de « et » : quatre-vingt-un, jamais quatre-vingt et un.
    return `quatre-vingt-${UNITES[u]}`;
  }

  if (u === 0) return DIZAINES[d];
  if (u === 1) return `${DIZAINES[d]} et un`;
  return `${DIZAINES[d]}-${UNITES[u]}`;
}

/** 0 à 999. `final` : voir `deuxChiffres`. */
function troisChiffres(n: number, final: boolean): string {
  if (n < 100) return deuxChiffres(n, final);

  const c = Math.floor(n / 100);
  const reste = n % 100;

  let tete: string;
  if (c === 1) {
    tete = 'cent';
  } else {
    // Le s de « cents » ne tient que si rien ne suit dans le groupe ET que le
    // groupe lui-même termine le nombre.
    tete = `${UNITES[c]} cent${reste === 0 && final ? 's' : ''}`;
  }

  return reste === 0 ? tete : `${tete} ${deuxChiffres(reste, final)}`;
}

/** La partie entière, sans unité monétaire. */
export function nombreEnLettres(n: number): string {
  const entier = Math.floor(Math.abs(n));
  if (entier === 0) return 'zéro';

  const milliards = Math.floor(entier / 1_000_000_000);
  const millions = Math.floor((entier % 1_000_000_000) / 1_000_000);
  const milliers = Math.floor((entier % 1_000_000) / 1000);
  const reste = entier % 1000;

  const parts: string[] = [];

  if (milliards) {
    parts.push(`${troisChiffres(milliards, true)} milliard${milliards > 1 ? 's' : ''}`);
  }
  if (millions) {
    parts.push(`${troisChiffres(millions, true)} million${millions > 1 ? 's' : ''}`);
  }
  if (milliers) {
    // « un mille » ne se dit pas, et « mille » ne prend jamais de s.
    parts.push(milliers === 1 ? 'mille' : `${troisChiffres(milliers, false)} mille`);
  }
  if (reste) {
    parts.push(troisChiffres(reste, true));
  }

  return parts.join(' ');
}

/**
 * Le montant complet, dirhams et centimes — la mention portée sur la facture.
 *
 * Les centimes sont arrondis au plus proche, et une retenue les fait passer
 * sur les dirhams : 1,999 donne « deux dirhams », jamais « un dirham et cent
 * centimes ».
 */
export function montantEnLettres(montant: number): string {
  const valeur = Math.abs(Number(montant) || 0);

  let dirhams = Math.floor(valeur);
  let centimes = Math.round((valeur - dirhams) * 100);

  if (centimes === 100) {
    dirhams += 1;
    centimes = 0;
  }

  const partieDirhams = `${nombreEnLettres(dirhams)} dirham${dirhams > 1 ? 's' : ''}`;
  if (centimes === 0) return partieDirhams;

  return `${partieDirhams} et ${nombreEnLettres(centimes)} centime${centimes > 1 ? 's' : ''}`;
}
