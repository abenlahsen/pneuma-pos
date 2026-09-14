import { ClientDetailPageComponent } from './client-detail-page.component';

/**
 * La carte d'encours porte son plafond et son action (motif « fiche », 3i).
 * Les calculs sont testes sans TestBed : ce sont des fonctions pures sur
 * le profil charge.
 */
describe('ClientDetailPageComponent — encours', () => {
  let comp: ClientDetailPageComponent;

  beforeEach(() => {
    comp = Object.create(ClientDetailPageComponent.prototype);
    (comp as any).profile = ClientDetailPageComponent.prototype.constructor
      ? null
      : null;
  });

  function withProfile(outstanding: number, creditLimit: number | null) {
    const signalLike = { value: { outstanding_balance: outstanding, client: { credit_limit: creditLimit } } };
    (comp as any).profile = () => signalLike.value;
    return comp;
  }

  describe('creditUsage', () => {
    it('vaut 0 quand aucun plafond n est defini : on ne divise pas par zero', () => {
      withProfile(5000, null);
      expect(comp.creditUsage()).toBe(0);
    });

    it('rend la part du plafond consommee', () => {
      withProfile(3000, 10000);
      expect(comp.creditUsage()).toBeCloseTo(0.3);
    });

    it('plafonne a 1 quand l encours depasse le plafond', () => {
      withProfile(15000, 10000);
      expect(comp.creditUsage()).toBe(1);
    });
  });

  describe('overCreditLimit', () => {
    it('est faux sans plafond, meme avec un encours eleve', () => {
      withProfile(99000, null);
      expect(comp.overCreditLimit()).toBe(false);
    });

    it('est faux tant que l encours reste sous le plafond', () => {
      withProfile(9999, 10000);
      expect(comp.overCreditLimit()).toBe(false);
    });

    it('est vrai des que l encours depasse le plafond', () => {
      withProfile(10001, 10000);
      expect(comp.overCreditLimit()).toBe(true);
    });
  });
});
