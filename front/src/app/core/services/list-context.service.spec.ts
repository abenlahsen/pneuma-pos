import { ListContextService } from './list-context.service';

/**
 * Le contexte de liste — refonte 2b, 6b.
 *
 * Deux propriétés comptent, et une seule est évidente. La première : suivre
 * l'ordre du tableau, pas celui des identifiants. La seconde : ne rien
 * inventer quand on arrive sur une fiche sans être passé par la liste.
 */
describe('ListContextService', () => {
  let service: ListContextService;

  beforeEach(() => {
    service = new ListContextService();
    // Page 3 sur 10, 5 lignes par page, 47 résultats — l'ordre est celui du
    // tableau (tri serveur), pas l'ordre naturel des identifiants.
    service.set('sales', { ids: [42, 7, 19, 88, 3], page: 3, lastPage: 10, perPage: 5, total: 47 });
  });

  describe('neighbours', () => {
    it("suit l'ordre du tableau", () => {
      expect(service.neighbours('sales', 19)).toEqual({ prev: 7, next: 88, position: '13 / 47' });
    });

    it('calcule le rang global, pas le rang dans la page', () => {
      expect(service.neighbours('sales', 42).position).toBe('11 / 47');
      expect(service.neighbours('sales', 3).position).toBe('15 / 47');
    });

    it("n'a pas de précédent sur la première ligne de la page", () => {
      const n = service.neighbours('sales', 42);
      expect(n.prev).toBeNull();
      expect(n.next).toBe(7);
    });

    it("n'a pas de suivant sur la dernière ligne de la page", () => {
      const n = service.neighbours('sales', 3);
      expect(n.prev).toBe(88);
      expect(n.next).toBeNull();
    });
  });

  describe('hors contexte', () => {
    it('ne dit rien pour un identifiant absent de la page retenue', () => {
      expect(service.neighbours('sales', 999)).toEqual({ prev: null, next: null, position: null });
    });

    it('ne dit rien quand aucune liste n’a été parcourue', () => {
      expect(service.neighbours('purchases', 42)).toEqual({ prev: null, next: null, position: null });
    });

    it('ne mélange pas deux listes', () => {
      service.set('purchases', { ids: [1, 2, 3], page: 1, lastPage: 1, perPage: 3, total: 3 });
      expect(service.neighbours('purchases', 2).prev).toBe(1);
      // 42 est une vente, pas un achat : le service ne doit pas la reconnaître ici
      expect(service.neighbours('purchases', 42).position).toBeNull();
      expect(service.neighbours('sales', 42).position).toBe('11 / 47');
    });
  });

  describe('set / clear', () => {
    it('remplace le contexte au rechargement de la liste', () => {
      service.set('sales', { ids: [5, 6], page: 1, lastPage: 1, perPage: 2, total: 2 });
      expect(service.neighbours('sales', 19).position).toBeNull();
      expect(service.neighbours('sales', 6)).toEqual({ prev: 5, next: null, position: '2 / 2' });
    });

    it('oublie une liste sans toucher aux autres', () => {
      service.set('purchases', { ids: [1, 2], page: 1, lastPage: 1, perPage: 2, total: 2 });
      service.clear('sales');
      expect(service.get('sales')).toBeNull();
      expect(service.get('purchases')).not.toBeNull();
    });
  });
});
