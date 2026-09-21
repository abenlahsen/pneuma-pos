import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../../../shared/icon/icon.component';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TransactionCategoryService } from '../data-access/transaction-category.service';
import { TransactionCategory, TransactionCategoryType } from '../models/transaction-category.model';
import { AuthService } from '../../../core/services/auth.service';
import { ConfirmDeleteComponent } from '../../../shared/confirm-delete/confirm-delete.component';
import { PendingDelete } from '../../../shared/confirm-delete/pending-delete';
import { TransactionCategoryFormComponent } from '../components/transaction-category-form/transaction-category-form.component';

import {
  ListErrorComponent,
  describeLoadError,
} from '../../../shared/list-state';

@Component({
  selector: 'app-transaction-categories-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, IconComponent, ListErrorComponent, ConfirmDeleteComponent, TransactionCategoryFormComponent],
  templateUrl: './transaction-categories-page.component.html',
  styleUrl: './transaction-categories-page.component.scss',
})
export class TransactionCategoriesPageComponent implements OnInit {

  // ── Suppression : confirmation 15c au lieu d'un confirm() natif ───────────
  readonly pendingDelete = signal<PendingDelete | null>(null);

  runPendingDelete(reason: string): void {
    const pending = this.pendingDelete();
    this.pendingDelete.set(null);
    pending?.run(reason);
  }
  activeType = signal<TransactionCategoryType>('expense');
  categories = signal<TransactionCategory[]>([]);
  loading = signal(false);

  // ── Refonte 2b, §14c état 3 : un chargement qui échoue ne doit pas passer
  // pour une absence de données. Cet écran n'est pas une liste filtrée : il ne
  // reçoit que cet état-là, les trois autres n'y auraient rien à dire.
  readonly loadError = signal<string | null>(null);
  readonly loadErrorDetail = signal<string | null>(null);
  readonly lastLoadedAt = signal<Date | null>(null);
  errorMessage = signal('');

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
        this.loadError.set(null);
        this.lastLoadedAt.set(new Date());
      },
      error: (err) => {
        const { cause, detail } = describeLoadError(err);
        this.loadError.set(cause);
        this.loadErrorDetail.set(detail);
        this.loading.set(false);
      },
    });
  }

  switchType(type: TransactionCategoryType): void {
    if (this.activeType() === type) return;
    this.activeType.set(type);
    this.closeAllForms();
    this.loadCategories();
  }

  private closeAllForms(): void {
    this.categoryForm.set(null);
  }

  /**
   * Refonte 2b, étape 5b : les trois saisies écrites en ligne — ajouter une
   * catégorie, ajouter une sous-catégorie, renommer — passent par le même
   * formulaire extrait. Un seul descripteur suffit : c'est `apply` qui sait
   * laquelle des trois on fait.
   */
  readonly categoryForm = signal<{
    initialName: string;
    parentName: string;
    childCount: number | null;
    apply: (name: string) => void;
  } | null>(null);

  openCategoryForm(): void {
    this.categoryForm.set({
      initialName: '',
      parentName: '',
      childCount: null,
      apply: (name) => this.createParent(name),
    });
  }

  openChildForm(parent: TransactionCategory): void {
    this.categoryForm.set({
      initialName: '',
      parentName: parent.name,
      childCount: null,
      apply: (name) => this.createChild(parent, name),
    });
  }

  openRenameForm(category: TransactionCategory, parent?: TransactionCategory): void {
    this.categoryForm.set({
      initialName: category.name,
      parentName: parent?.name ?? '',
      childCount: category.children?.length ?? null,
      apply: (name) => this.rename(category, name),
    });
  }

  submitCategoryForm(rawName: string): void {
    const name = rawName.trim();
    // Le formulaire désactive déjà son bouton sur un nom vide, mais la page
    // reste la dernière à pouvoir refuser : elle ne suppose rien de l'appelant.
    if (!name) return;

    const form = this.categoryForm();
    this.categoryForm.set(null);
    form?.apply(name);
  }

  private createParent(name: string): void {
    this.transactionCategoryService.create({ name, type: this.activeType() }).subscribe({
      next: (category) => {
        this.categories.update((list) => [...list, category]);
      },
      error: (err) => this.showError(err),
    });
  }

  private createChild(parent: TransactionCategory, name: string): void {
    this.transactionCategoryService.create({ name, type: this.activeType(), parent_id: parent.id }).subscribe({
      next: (child) => {
        this.categories.update((list) =>
          list.map((c) => (c.id === parent.id ? { ...c, children: [...(c.children || []), child] } : c)),
        );
      },
      error: (err) => this.showError(err),
    });
  }

  private rename(category: TransactionCategory, name: string): void {
    this.transactionCategoryService.update(category.id, { name }).subscribe({
      next: (updated) => {
        this.categories.update((list) => this.replaceInTree(list, updated));
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

  toggleIsConfidential(category: TransactionCategory): void {
    this.transactionCategoryService
      .update(category.id, { is_confidential: !category.is_confidential })
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
    this.pendingDelete.set({
      title: `Supprimer ${label} ?`,
      consequence: (category.children?.length ?? 0) > 0
        ? `Ses ${category.children!.length} sous-catégorie(s) disparaissent avec elle.`
        : 'Les transactions déjà classées ici gardent leur libellé.',
      run: () => this.performDeleteCategory(category, parent),
    });
  }

  private performDeleteCategory(category: TransactionCategory, parent?: TransactionCategory): void {
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
