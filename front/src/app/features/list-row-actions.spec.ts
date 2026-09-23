/// <reference types="vite/client" />

/**
 * Garde-fou du motif de ligne — refonte 2b.
 *
 * Sous `$bp-reshape`, le mixin `list-row-pattern()` remet toute la rangée à
 * plat (`> * { display: none }`) et ne réaffiche que quatre emplacements
 * nommés : `--identity`, `--amount`, `.list-grid-status` et `--actions`. Une
 * cellule d'actions qui ne porte pas `list-cell--actions` **disparaît donc
 * purement et simplement sur mobile** — sans erreur, sans avertissement.
 *
 * Trois écrans (Clients, Produits, Fournisseurs) vivaient exactement ce cas :
 * seul un `style="display: flex"` en ligne, hérité d'avant le mixin, les
 * sauvait par accident. Le jour où on l'a retiré, la règle est devenue la
 * seule protection — d'où ce test, qui lit les gabarits eux-mêmes.
 *
 * Il ne remplace pas un œil sur l'écran : il empêche la régression silencieuse.
 */

// `?raw` donne le source du gabarit, `eager` l'inline au build du test : pas de
// système de fichiers, donc pas besoin des types Node.
const TEMPLATES = import.meta.glob('./**/*.html', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** Les gabarits qui rendent une liste au motif de ligne. */
function rowPatternTemplates(): [string, string][] {
  return Object.entries(TEMPLATES).filter(([, html]) => html.includes('list-grid-row'));
}

/** Toutes les valeurs d'attribut `class` d'un gabarit, statiques comme liées. */
function classAttributes(html: string): { value: string; tag: string }[] {
  const found: { value: string; tag: string }[] = [];
  const re = /<([a-zA-Z][\w-]*)\b[^>]*?\bclass="([^"]*)"/g;

  for (const match of html.matchAll(re)) {
    found.push({ tag: match[1], value: match[2] });
  }

  return found;
}

describe('motif de ligne — la cellule d’actions', () => {
  it('trouve bien les gabarits à contrôler', () => {
    // Si le glob casse, tous les tests ci-dessous passeraient à vide.
    expect(rowPatternTemplates().length).toBeGreaterThan(5);
  });

  it('nomme toujours sa cellule `list-cell--actions`, sinon elle disparaît sous 900 px', () => {
    const coupables: string[] = [];

    for (const [file, html] of rowPatternTemplates()) {
      for (const { value } of classAttributes(html)) {
        const classes = value.split(/\s+/);
        if (classes.includes('actions-cell') && !classes.includes('list-cell--actions')) {
          coupables.push(`${file} → class="${value}"`);
        }
      }
    }

    expect(coupables).toEqual([]);
  });

  it('ne remet pas la mise en page de la rangée dans un style en ligne', () => {
    // C'est le mixin qui porte `display: flex; gap: 5px; justify-content:
    // flex-end`. Un style en ligne le doublerait en échappant au seuil, et
    // masquerait à nouveau le défaut que le test précédent surveille.
    const coupables: string[] = [];
    const re = /<[a-zA-Z][\w-]*\b[^>]*?\bclass="([^"]*)"[^>]*?\bstyle="([^"]*)"/g;

    for (const [file, html] of rowPatternTemplates()) {
      for (const match of html.matchAll(re)) {
        const classes = match[1].split(/\s+/);
        if (classes.includes('actions-cell') || classes.includes('list-cell--actions')) {
          coupables.push(`${file} → style="${match[2]}"`);
        }
      }
    }

    expect(coupables).toEqual([]);
  });

  it('nomme une cellule d’identité, sinon la fiche est vide sous 900 px', () => {
    // Sous $bp-reshape, seuls les quatre emplacements nommés survivent. Une
    // liste qui n'en déclare aucun affiche des rangées vides — c'est ce qui
    // est arrivé à Produits, dont la cellule ne portait qu'un `style` en ligne.
    const coupables: string[] = [];

    for (const [file, html] of rowPatternTemplates()) {
      if (!html.includes('list-cell--identity')) {
        coupables.push(file);
      }
    }

    expect(coupables).toEqual([]);
  });

  it('laisse le libellé du menu ⋯ au composant, jamais à l’écran', () => {
    // `.ro-label` est masqué par `app-row-overflow` lui-même et réaffiché sous
    // le seuil. Le redéclarer écran par écran, c'est reprendre le risque que
    // l'un d'eux l'oublie — comme Produits l'avait oublié.
    const coupables: string[] = [];

    for (const [file, html] of Object.entries(TEMPLATES)) {
      if (html.includes('ro-label') && !html.includes('app-row-overflow')) {
        coupables.push(file);
      }
    }

    expect(coupables).toEqual([]);
  });
});
