import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TransactionCategoryService } from '../data-access/transaction-category.service';
import { TransactionCategory, TransactionCategoryType } from '../models/transaction-category.model';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-transaction-categories-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './transaction-categories-page.component.html',
  styleUrl: './transaction-categories-page.component.scss',
})
export class TransactionCategoriesPageComponent implements OnInit {
  activeType = signal<TransactionCategoryType>('expense');
  categories = signal<TransactionCategory[]>([]);
  loading = signal(false);
  errorMessage = signal('');

  addingParent = signal(false);
  newParentName = signal('');

  addingChildFor = signal<number | null>(null);
  newChildName = signal('');

  editingId = signal<number | null>(null);
  editingName = signal('');

  constructor(
    private transactionCategoryService: TransactionCategoryService,
    public authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.loadCategories();
  }

  loadCategories(): void {
    this.loading.set(true);
    this.transactionCategoryService.getTree(this.activeType()).subscribe({
      next: (categories) => {
        this.categories.set(categories);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  switchType(type: TransactionCategoryType): void {
    if (this.activeType() === type) return;
    this.activeType.set(type);
    this.closeAllForms();
    this.loadCategories();
  }

  private closeAllForms(): void {
    this.addingParent.set(false);
    this.newParentName.set('');
    this.addingChildFor.set(null);
    this.newChildName.set('');
    this.editingId.set(null);
    this.editingName.set('');
  }

  openAddParent(): void {
    this.addingParent.set(true);
    this.newParentName.set('');
  }

  cancelAddParent(): void {
    this.addingParent.set(false);
    this.newParentName.set('');
  }

  submitAddParent(): void {
    const name = this.newParentName().trim();
    if (!name) return;

    this.transactionCategoryService.create({ name, type: this.activeType() }).subscribe({
      next: (category) => {
        this.categories.update((list) => [...list, category]);
        this.cancelAddParent();
      },
      error: (err) => this.showError(err),
    });
  }

  openAddChild(parentId: number): void {
    this.addingChildFor.set(parentId);
    this.newChildName.set('');
  }

  cancelAddChild(): void {
    this.addingChildFor.set(null);
    this.newChildName.set('');
  }

  submitAddChild(parent: TransactionCategory): void {
    const name = this.newChildName().trim();
    if (!name) return;

    this.transactionCategoryService.create({ name, type: this.activeType(), parent_id: parent.id }).subscribe({
      next: (child) => {
        this.categories.update((list) =>
          list.map((c) => (c.id === parent.id ? { ...c, children: [...(c.children || []), child] } : c)),
        );
        this.cancelAddChild();
      },
      error: (err) => this.showError(err),
    });
  }

  startEdit(category: TransactionCategory): void {
    this.editingId.set(category.id);
    this.editingName.set(category.name);
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.editingName.set('');
  }

  submitEdit(category: TransactionCategory): void {
    const name = this.editingName().trim();
    if (!name) return;

    this.transactionCategoryService.update(category.id, { name }).subscribe({
      next: (updated) => {
        this.categories.update((list) => this.replaceInTree(list, updated));
        this.cancelEdit();
      },
      error: (err) => this.showError(err),
    });
  }

  toggleCountsAsExpense(category: TransactionCategory): void {
    this.transactionCategoryService
      .update(category.id, { counts_as_expense: !category.counts_as_expense })
      .subscribe({
        next: (updated) => this.categories.update((list) => this.replaceInTree(list, updated)),
        error: (err) => this.showError(err),
      });
  }

  toggleCountsAsRevenue(category: TransactionCategory): void {
    this.transactionCategoryService
      .update(category.id, { counts_as_revenue: !category.counts_as_revenue })
      .subscribe({
        next: (updated) => this.categories.update((list) => this.replaceInTree(list, updated)),
        error: (err) => this.showError(err),
      });
  }

  private replaceInTree(list: TransactionCategory[], updated: TransactionCategory): TransactionCategory[] {
    return list.map((c) => {
      if (c.id === updated.id) return { ...c, ...updated, children: c.children };
      if (c.children?.length) {
        return { ...c, children: c.children.map((child) => (child.id === updated.id ? { ...child, ...updated } : child)) };
      }
      return c;
    });
  }

  deleteCategory(category: TransactionCategory, parent?: TransactionCategory): void {
    const label = parent ? `la sous-catégorie « ${category.name} »` : `la catégorie « ${category.name} »`;
    if (!confirm(`Supprimer ${label} ?`)) return;

    this.transactionCategoryService.delete(category.id).subscribe({
      next: () => {
        if (parent) {
          this.categories.update((list) =>
            list.map((c) => (c.id === parent.id ? { ...c, children: (c.children || []).filter((ch) => ch.id !== category.id) } : c)),
          );
        } else {
          this.categories.update((list) => list.filter((c) => c.id !== category.id));
        }
      },
      error: (err) => this.showError(err),
    });
  }

  private showError(err: any): void {
    const msg =
      err?.error?.errors?.category?.[0] ||
      err?.error?.errors?.name?.[0] ||
      err?.error?.errors?.parent_id?.[0] ||
      err?.error?.message ||
      'Une erreur est survenue.';
    this.errorMessage.set(msg);
    setTimeout(() => this.errorMessage.set(''), 5000);
  }
}
