import { of, throwError } from 'rxjs';
import { TransactionCategoriesPageComponent } from './transaction-categories-page.component';
import { TransactionCategory } from '../models/transaction-category.model';

function makeCategory(overrides: Partial<TransactionCategory> = {}): TransactionCategory {
  return {
    id: 1,
    name: 'Loyer',
    type: 'expense',
    parent_id: null,
    is_system: false,
    is_active: true,
    counts_as_expense: true,
    counts_as_revenue: false,
    is_confidential: false,
    sort_order: 0,
    children: [],
    ...overrides,
  };
}

describe('TransactionCategoriesPageComponent', () => {
  let comp: TransactionCategoriesPageComponent;
  let mockService: {
    getTree: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  const mockAuthService = { hasPermission: () => true };

  beforeEach(() => {
    mockService = {
      getTree: vi.fn().mockReturnValue(of([])),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    comp = new TransactionCategoriesPageComponent(mockService as any, mockAuthService as any);
  });

  describe('switchType', () => {
    it('reloads categories and closes open forms when switching type', () => {
      comp.openCategoryForm();

      comp.switchType('income');

      expect(comp.activeType()).toBe('income');
      expect(comp.categoryForm()).toBeNull();
      expect(mockService.getTree).toHaveBeenCalledWith('income');
    });

    it('does nothing when switching to the already-active type', () => {
      mockService.getTree.mockClear();
      comp.switchType('expense');
      expect(mockService.getTree).not.toHaveBeenCalled();
    });
  });

  /**
   * Refonte 2b, étape 5b : les trois saisies écrites en ligne sont passées dans
   * un formulaire extrait. Les tests décrivent donc la saisie — openCategoryForm,
   * openChildForm, openRenameForm — puis la soumettent, au lieu de remplir des
   * signaux de page qui n'existent plus.
   */
  describe("ajout d'une catégorie", () => {
    it('does not call the API when the name is blank', () => {
      comp.openCategoryForm();
      comp.submitCategoryForm('   ');
      expect(mockService.create).not.toHaveBeenCalled();
    });

    it('appends the created category and closes the add form', () => {
      const created = makeCategory({ id: 5, name: 'Loyer' });
      mockService.create.mockReturnValue(of(created));
      comp.openCategoryForm();
      comp.submitCategoryForm('Loyer');

      expect(comp.categories()).toContainEqual(created);
      expect(comp.categoryForm()).toBeNull();
    });

    it('surfaces a validation error from the API without closing the form', () => {
      mockService.create.mockReturnValue(throwError(() => ({ error: { errors: { name: ['Déjà utilisé.'] } } })));
      comp.openCategoryForm();
      comp.submitCategoryForm('Loyer');

      expect(comp.errorMessage()).toBe('Déjà utilisé.');
    });
  });

  describe("ajout d'une sous-catégorie", () => {
    it('appends the child under its parent', () => {
      const parent = makeCategory({ id: 1, name: 'Loyer', children: [] });
      comp.categories.set([parent]);
      const child = makeCategory({ id: 2, name: 'Bureau', parent_id: 1 });
      mockService.create.mockReturnValue(of(child));

      comp.openChildForm(parent);
      comp.submitCategoryForm('Bureau');

      expect(comp.categories()[0].children).toContainEqual(child);
    });
  });

  describe('renommage', () => {
    it('replaces a top-level category in place', () => {
      comp.categories.set([makeCategory({ id: 1, name: 'Old' })]);
      const updated = makeCategory({ id: 1, name: 'New' });
      mockService.update.mockReturnValue(of(updated));

      comp.openRenameForm(comp.categories()[0]);
      comp.submitCategoryForm('New');

      expect(comp.categories()[0].name).toBe('New');
      expect(comp.categoryForm()).toBeNull();
    });

    it('replaces a child category without disturbing its siblings', () => {
      const child1 = makeCategory({ id: 2, name: 'Bureau', parent_id: 1 });
      const child2 = makeCategory({ id: 3, name: 'Entrepôt', parent_id: 1 });
      comp.categories.set([makeCategory({ id: 1, name: 'Loyer', children: [child1, child2] })]);
      const updatedChild = makeCategory({ id: 2, name: 'Siège', parent_id: 1 });
      mockService.update.mockReturnValue(of(updatedChild));

      comp.openRenameForm(child1, comp.categories()[0]);
      comp.submitCategoryForm('Siège');

      const children = comp.categories()[0].children!;
      expect(children.find((c) => c.id === 2)!.name).toBe('Siège');
      expect(children.find((c) => c.id === 3)!.name).toBe('Entrepôt');
    });
  });

  describe('toggleCountsAsExpense', () => {
    it('calls update with the flag inverted and replaces the category in place', () => {
      const category = makeCategory({ id: 1, counts_as_expense: true });
      comp.categories.set([category]);
      const updated = makeCategory({ id: 1, counts_as_expense: false });
      mockService.update.mockReturnValue(of(updated));

      comp.toggleCountsAsExpense(category);

      expect(mockService.update).toHaveBeenCalledWith(1, { counts_as_expense: false });
      expect(comp.categories()[0].counts_as_expense).toBe(false);
    });

    it('surfaces an API error without mutating the list', () => {
      const category = makeCategory({ id: 1, counts_as_expense: true });
      comp.categories.set([category]);
      mockService.update.mockReturnValue(throwError(() => ({ error: { message: 'Erreur serveur.' } })));

      comp.toggleCountsAsExpense(category);

      expect(comp.errorMessage()).toBe('Erreur serveur.');
      expect(comp.categories()[0].counts_as_expense).toBe(true);
    });
  });

  describe('toggleCountsAsRevenue', () => {
    it('calls update with the flag inverted and replaces the category in place', () => {
      const category = makeCategory({ id: 1, type: 'income', counts_as_revenue: true });
      comp.categories.set([category]);
      const updated = makeCategory({ id: 1, type: 'income', counts_as_revenue: false });
      mockService.update.mockReturnValue(of(updated));

      comp.toggleCountsAsRevenue(category);

      expect(mockService.update).toHaveBeenCalledWith(1, { counts_as_revenue: false });
      expect(comp.categories()[0].counts_as_revenue).toBe(false);
    });

    it('surfaces an API error without mutating the list', () => {
      const category = makeCategory({ id: 1, type: 'income', counts_as_revenue: true });
      comp.categories.set([category]);
      mockService.update.mockReturnValue(throwError(() => ({ error: { message: 'Erreur serveur.' } })));

      comp.toggleCountsAsRevenue(category);

      expect(comp.errorMessage()).toBe('Erreur serveur.');
      expect(comp.categories()[0].counts_as_revenue).toBe(true);
    });
  });

  describe('toggleIsConfidential', () => {
    it('calls update with the flag inverted and replaces the category in place', () => {
      const category = makeCategory({ id: 1, is_confidential: false });
      comp.categories.set([category]);
      const updated = makeCategory({ id: 1, is_confidential: true });
      mockService.update.mockReturnValue(of(updated));

      comp.toggleIsConfidential(category);

      expect(mockService.update).toHaveBeenCalledWith(1, { is_confidential: true });
      expect(comp.categories()[0].is_confidential).toBe(true);
    });

    it('surfaces an API error without mutating the list', () => {
      const category = makeCategory({ id: 1, is_confidential: false });
      comp.categories.set([category]);
      mockService.update.mockReturnValue(throwError(() => ({ error: { message: 'Erreur serveur.' } })));

      comp.toggleIsConfidential(category);

      expect(comp.errorMessage()).toBe('Erreur serveur.');
      expect(comp.categories()[0].is_confidential).toBe(false);
    });
  });

  describe('deleteCategory', () => {
    /**
     * Depuis le gabarit 15c, la méthode de suppression n'appelle plus l'API :
     * elle décrit la suppression, que `runPendingDelete` exécute ensuite. Les
     * tests suivent le même chemin que l'utilisateur — décrire, puis confirmer.
     */

    it('does not call the API when the user cancels the confirmation', () => {
      comp.deleteCategory(makeCategory());
      // on ne confirme pas : la suppression reste en attente
      expect(mockService.delete).not.toHaveBeenCalled();
    });

    it('removes a top-level category from the list on success', () => {
      mockService.delete.mockReturnValue(of(undefined));
      comp.categories.set([makeCategory({ id: 1 }), makeCategory({ id: 2 })]);

      comp.deleteCategory(comp.categories()[0]);
      comp.runPendingDelete('');

      expect(comp.categories().map((c) => c.id)).toEqual([2]);
    });

    it('removes a child from its parent on success', () => {
      mockService.delete.mockReturnValue(of(undefined));
      const child = makeCategory({ id: 2, parent_id: 1 });
      const parent = makeCategory({ id: 1, children: [child] });
      comp.categories.set([parent]);

      comp.deleteCategory(child, parent);
      comp.runPendingDelete('');

      expect(comp.categories()[0].children).toEqual([]);
    });

    it('surfaces the "used by transactions" error and keeps the category', () => {
      mockService.delete.mockReturnValue(throwError(() => ({
        error: { errors: { category: ['Impossible de supprimer cette catégorie car elle est utilisée par des transactions.'] } },
      })));
      const category = makeCategory({ id: 1 });
      comp.categories.set([category]);

      comp.deleteCategory(category);
      comp.runPendingDelete('');

      expect(comp.errorMessage()).toContain('utilisée par des transactions');
      expect(comp.categories()).toHaveLength(1);
    });
  });
});
