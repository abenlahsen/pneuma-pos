import { BrandFormComponent } from '../../features/brands/components/brand-form/brand-form.component';
import { CarrierFormComponent } from '../../features/carriers/components/carrier-form/carrier-form.component';

/**
 * Le pied du gabarit 15b — « ce qui dépend de cet objet ».
 *
 * Deux règles s'y jouent, et aucune des deux n'est évidente :
 *
 *   1. `null` et `0` ne veulent pas dire la même chose. `0` est une certitude
 *      (« rien ne dépend de cet objet, tu peux le supprimer ») ; `null` est une
 *      ignorance (création en cours, ou compte absent de la réponse). La coque
 *      n'affiche rien pour `null`, ce qui vaut mieux qu'un zéro rassurant à tort.
 *
 *   2. En français, zéro prend le singulier — « 0 produit lié », pas
 *      « 0 produits liés ». C'est l'inverse de l'anglais, et c'est la faute que
 *      l'on fait en portant une règle `count !== 1` d'une langue à l'autre.
 */
describe('gabarit 15b — le compte d’objets liés', () => {
  describe('BrandFormComponent', () => {
    let comp: BrandFormComponent;

    beforeEach(() => {
      comp = new BrandFormComponent();
    });

    it('ne sait rien à la création : le pied reste vide', () => {
      comp.brand = null;
      expect(comp.linkedCount).toBeNull();
    });

    it("ne sait rien quand l'API n'a pas compté", () => {
      comp.brand = { id: 1, name: 'MICHELIN', logo: null, is_active: true };
      expect(comp.linkedCount).toBeNull();
    });

    it('distingue zéro de inconnu', () => {
      comp.brand = { id: 1, name: 'MICHELIN', logo: null, is_active: true, products_count: 0 };
      expect(comp.linkedCount).toBe(0);
    });

    it('met le singulier à zéro et à un, le pluriel au-delà', () => {
      const labelFor = (products_count?: number) => {
        comp.brand = { id: 1, name: 'MICHELIN', logo: null, is_active: true, products_count };
        return `${comp.linkedCount ?? ''} ${comp.linkedLabel}`.trim();
      };

      expect(labelFor(0)).toBe('0 produit lié');
      expect(labelFor(1)).toBe('1 produit lié');
      expect(labelFor(2)).toBe('2 produits liés');
      expect(labelFor(412)).toBe('412 produits liés');
    });
  });

  describe('CarrierFormComponent', () => {
    let comp: CarrierFormComponent;

    beforeEach(() => {
      comp = new CarrierFormComponent();
    });

    it('ne sait rien à la création : le pied reste vide', () => {
      comp.carrier = null;
      expect(comp.linkedCount).toBeNull();
    });

    it('met le singulier à zéro et à un, le pluriel au-delà', () => {
      const labelFor = (sales_count?: number) => {
        comp.carrier = { id: 1, name: 'SDTM', sales_count };
        return `${comp.linkedCount ?? ''} ${comp.linkedLabel}`.trim();
      };

      expect(labelFor(0)).toBe('0 vente livrée');
      expect(labelFor(1)).toBe('1 vente livrée');
      expect(labelFor(2)).toBe('2 ventes livrées');
      expect(labelFor(592)).toBe('592 ventes livrées');
    });

    /**
     * Le compte est une lecture, pas une saisie : il ne doit pas repartir dans
     * le corps de la requête. `ngOnInit` recopie donc champ par champ au lieu
     * d'étaler l'objet.
     */
    it("n'emporte pas le compte dans le formulaire soumis", () => {
      comp.carrier = { id: 1, name: 'SDTM', phone: '0612', email: 'a@b.c', sales_count: 592 };
      comp.ngOnInit();

      expect(comp.formData).toEqual({ name: 'SDTM', phone: '0612', email: 'a@b.c' });
      expect('sales_count' in comp.formData).toBe(false);
      expect('id' in comp.formData).toBe(false);
    });
  });
});
