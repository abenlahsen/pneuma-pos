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
      comp.addingParent.set(true);
      comp.newParentName.set('draft');

      comp.switchType('income');

      expect(comp.activeType()).toBe('income');
      expect(comp.addingParent()).toBe(false);
      expect(comp.newParentName()).toBe('');
      expect(mockService.getTree).toHaveBeenCalledWith('income');
    });

    it('does nothing when switching to the already-active type', () => {
      mockService.getTree.mockClear();
      comp.switchType('expense');
      expect(mockService.getTree).not.toHaveBeenCalled();
    });
  });

  describe('submitAddParent', () => {
    it('does not call the API when the name is blank', () => {
      comp.newParentName.set('   ');
      comp.submitAddParent();
      expect(mockService.create).not.toHaveBeenCalled();
    });

    it('appends the created category and closes the add form', () => {
      const created = makeCategory({ id: 5, name: 'Loyer' });
      mockService.create.mockReturnValue(of(created));
      comp.addingParent.set(true);
      comp.newParentName.set('Loyer');

      comp.submitAddParent();

      expect(comp.categories()).toContainEqual(created);
      expect(comp.addingParent()).toBe(false);
    });

    it('surfaces a validation error from the API without closing the form', () => {
      mockService.create.mockReturnValue(throwError(() => ({ error: { errors: { name: ['Déjà utilisé.'] } } })));
      comp.addingParent.set(true);
      comp.newParentName.set('Loyer');

      comp.submitAddParent();

      expect(comp.errorMessage()).toBe('Déjà utilisé.');
      expect(comp.addingParent()).toBe(true);
    });
  });

  describe('submitAddChild', () => {
    it('appends the child under its parent', () => {
      const parent = makeCategory({ id: 1, name: 'Loyer', children: [] });
      comp.categories.set([parent]);
      const child = makeCategory({ id: 2, name: 'Bureau', parent_id: 1 });
      mockService.create.mockReturnValue(of(child));
      comp.newChildName.set('Bureau');

      comp.submitAddChild(parent);

      expect(comp.categories()[0].children).toContainEqual(child);
    });
  });

  describe('submitEdit', () => {
    it('replaces a top-level category in place', () => {
      comp.categories.set([makeCategory({ id: 1, name: 'Old' })]);
      const updated = makeCategory({ id: 1, name: 'New' });
      mockService.update.mockReturnValue(of(updated));
      comp.editingId.set(1);
      comp.editingName.set('New');

      comp.submitEdit(comp.categories()[0]);

      expect(comp.categories()[0].name).toBe('New');
      expect(comp.editingId()).toBeNull();
    });

    it('replaces a child category without disturbing its siblings', () => {
      const child1 = makeCategory({ id: 2, name: 'Bureau', parent_id: 1 });
      const child2 = makeCategory({ id: 3, name: 'Entrepôt', parent_id: 1 });
      comp.categories.set([makeCategory({ id: 1, name: 'Loyer', children: [child1, child2] })]);
      const updatedChild = makeCategory({ id: 2, name: 'Siège', parent_id: 1 });
      mockService.update.mockReturnValue(of(updatedChild));
      comp.editingName.set('Siège');

      comp.submitEdit(child1);

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

  describe('deleteCategory', () => {
    let confirmSpy: ReturnType<typeof vi.spyOn>;
    afterEach(() => confirmSpy.mockRestore());

    it('does not call the API when the user cancels the confirmation', () => {
      confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
      comp.deleteCategory(makeCategory());
      expect(mockService.delete).not.toHaveBeenCalled();
    });

    it('removes a top-level category from the list on success', () => {
      confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
      mockService.delete.mockReturnValue(of(undefined));
      comp.categories.set([makeCategory({ id: 1 }), makeCategory({ id: 2 })]);

      comp.deleteCategory(comp.categories()[0]);

      expect(comp.categories().map((c) => c.id)).toEqual([2]);
    });

    it('removes a child from its parent on success', () => {
      confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
      mockService.delete.mockReturnValue(of(undefined));
      const child = makeCategory({ id: 2, parent_id: 1 });
      const parent = makeCategory({ id: 1, children: [child] });
      comp.categories.set([parent]);

      comp.deleteCategory(child, parent);

      expect(comp.categories()[0].children).toEqual([]);
    });

    it('surfaces the "used by transactions" error and keeps the category', () => {
      confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
      mockService.delete.mockReturnValue(throwError(() => ({
        error: { errors: { category: ['Impossible de supprimer cette catégorie car elle est utilisée par des transactions.'] } },
      })));
      const category = makeCategory({ id: 1 });
      comp.categories.set([category]);

      comp.deleteCategory(category);

      expect(comp.errorMessage()).toContain('utilisée par des transactions');
      expect(comp.categories()).toHaveLength(1);
    });
  });
});
