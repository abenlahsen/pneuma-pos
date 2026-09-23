import { montantEnLettres, nombreEnLettres } from './montant-en-lettres';

/**
 * Les douze valeurs exigées par le §10a, plus les pièges voisins. Ce n'est pas
 * du confort de lecture : sur une facture, le montant en lettres fait foi
 * contre le chiffre en cas de litige. Un accord faux est une erreur
 * comptable, pas une faute d'orthographe.
 */
describe('nombreEnLettres', () => {
  describe('les douze valeurs du cahier des charges', () => {
    const attendu: [number, string][] = [
      [0, 'zéro'],
      [1, 'un'],
      [21, 'vingt et un'],
      [71, 'soixante et onze'],
      [80, 'quatre-vingts'],
      [81, 'quatre-vingt-un'],
      [100, 'cent'],
      [200, 'deux cents'],
      [1000, 'mille'],
      [1001, 'mille un'],
      [17556, 'dix-sept mille cinq cent cinquante-six'],
      [1000000, 'un million'],
    ];

    for (const [valeur, mots] of attendu) {
      it(`${valeur} → ${mots}`, () => {
        expect(nombreEnLettres(valeur)).toBe(mots);
      });
    }
  });

  describe('le s de vingt et de cent', () => {
    it('tombe dès qu’un mot de nombre suit', () => {
      expect(nombreEnLettres(201)).toBe('deux cent un');
      expect(nombreEnLettres(283)).toBe('deux cent quatre-vingt-trois');
    });

    it('tombe aussi devant « mille », qui est un mot de nombre', () => {
      expect(nombreEnLettres(200_000)).toBe('deux cent mille');
      expect(nombreEnLettres(80_000)).toBe('quatre-vingt mille');
    });

    it('survit devant « millions », qui est un nom', () => {
      expect(nombreEnLettres(200_000_000)).toBe('deux cents millions');
      expect(nombreEnLettres(80_000_000)).toBe('quatre-vingts millions');
    });
  });

  describe('« mille » est invariable', () => {
    it('ne prend jamais de s, quel que soit le multiplicateur', () => {
      expect(nombreEnLettres(2000)).toBe('deux mille');
      expect(nombreEnLettres(300_000)).toBe('trois cent mille');
    });

    it('ne se dit pas « un mille »', () => {
      expect(nombreEnLettres(1000)).toBe('mille');
      expect(nombreEnLettres(1100)).toBe('mille cent');
    });
  });

  describe('les dizaines à rallonge', () => {
    it('70 à 79 comptent sur soixante', () => {
      expect(nombreEnLettres(70)).toBe('soixante-dix');
      expect(nombreEnLettres(72)).toBe('soixante-douze');
      expect(nombreEnLettres(77)).toBe('soixante-dix-sept');
    });

    it('90 à 99 comptent sur quatre-vingt, et sans « et »', () => {
      expect(nombreEnLettres(90)).toBe('quatre-vingt-dix');
      expect(nombreEnLettres(91)).toBe('quatre-vingt-onze');
      expect(nombreEnLettres(99)).toBe('quatre-vingt-dix-neuf');
    });

    it('le « et » ne vit que sur 21, 31… 61 et 71', () => {
      expect(nombreEnLettres(31)).toBe('trente et un');
      expect(nombreEnLettres(61)).toBe('soixante et un');
      expect(nombreEnLettres(22)).toBe('vingt-deux');
    });
  });

  describe('les grands nombres', () => {
    it('accorde millions et milliards, qui sont des noms', () => {
      expect(nombreEnLettres(2_000_000)).toBe('deux millions');
      expect(nombreEnLettres(1_000_000_000)).toBe('un milliard');
      expect(nombreEnLettres(3_000_000_000)).toBe('trois milliards');
    });

    it('enchaîne les tranches dans l’ordre', () => {
      expect(nombreEnLettres(1_234_567)).toBe(
        'un million deux cent trente-quatre mille cinq cent soixante-sept',
      );
    });
  });
});

describe('montantEnLettres', () => {
  it('écrit la valeur du cahier des charges avec ses centimes', () => {
    expect(montantEnLettres(17556.48)).toBe(
      'dix-sept mille cinq cent cinquante-six dirhams et quarante-huit centimes',
    );
  });

  it('accorde dirham et centime au singulier', () => {
    expect(montantEnLettres(1)).toBe('un dirham');
    expect(montantEnLettres(1.01)).toBe('un dirham et un centime');
  });

  it('tait les centimes quand il n’y en a pas', () => {
    expect(montantEnLettres(200)).toBe('deux cents dirhams');
    expect(montantEnLettres(1000)).toBe('mille dirhams');
  });

  it('dit zéro plutôt que rien', () => {
    expect(montantEnLettres(0)).toBe('zéro dirham');
  });

  it('reporte la retenue au lieu d’écrire cent centimes', () => {
    // 1,999 arrondi au centime fait 2,00 — pas « un dirham et cent centimes ».
    expect(montantEnLettres(1.999)).toBe('deux dirhams');
  });

  it('arrondit le centime au plus proche', () => {
    expect(montantEnLettres(10.004)).toBe('dix dirhams');
    expect(montantEnLettres(10.005)).toBe('dix dirhams et un centime');
  });

  it('ne se laisse pas démonter par une entrée absente', () => {
    expect(montantEnLettres(NaN)).toBe('zéro dirham');
    expect(montantEnLettres(undefined as unknown as number)).toBe('zéro dirham');
  });
});
