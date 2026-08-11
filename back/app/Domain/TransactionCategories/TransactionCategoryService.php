<?php

namespace App\Domain\TransactionCategories;

use App\Models\Transaction;
use App\Models\TransactionCategory;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class TransactionCategoryService
{
    /**
     * @param  bool  $includeConfidential  true only when the caller has `view hr-charges` —
     *                                     otherwise categories like 'Charges RH' (and their
     *                                     children) are omitted entirely, so the picker on the
     *                                     Cash Flow form never reveals "Salaires"/"CNSS".
     */
    public function list(?string $type = null, bool $onlyActive = false, bool $includeConfidential = false): Collection
    {
        return TransactionCategory::query()
            ->topLevel()
            ->with(['children' => function ($query) use ($onlyActive) {
                if ($onlyActive) {
                    $query->active();
                }
            }])
            ->when($type, fn ($query) => $query->ofType($type))
            ->when($onlyActive, fn ($query) => $query->active())
            ->when(! $includeConfidential, fn ($query) => $query->where('is_confidential', false))
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();
    }

    public function create(array $validated): TransactionCategory
    {
        $this->guardParentDepth($validated['parent_id'] ?? null, $validated['type']);

        return TransactionCategory::create($validated);
    }

    public function update(TransactionCategory $category, array $validated): TransactionCategory
    {
        $this->guardSystem($category);

        if (array_key_exists('parent_id', $validated)) {
            $this->guardParentDepth($validated['parent_id'], $validated['type'] ?? $category->type);
        }

        $oldName = $category->name;
        $isRoot = $category->parent_id === null;
        $type = $category->type;
        $parentName = $isRoot ? null : $category->parent?->name;

        DB::transaction(function () use ($category, $validated, $oldName, $isRoot, $type, $parentName) {
            $category->update($validated);

            // `transactions.category`/`subcategory` store the category name
            // as a plain string (no FK) — a rename must be propagated or the
            // existing transactions silently fall out of the KPI and fail
            // revalidation on their next edit.
            $newName = $category->name;

            if ($newName !== $oldName) {
                if ($isRoot) {
                    Transaction::where('type', $type)->where('category', $oldName)
                        ->update(['category' => $newName]);
                } else {
                    Transaction::where('type', $type)
                        ->where('category', $parentName)
                        ->where('subcategory', $oldName)
                        ->update(['subcategory' => $newName]);
                }
            }
        });

        return $category->fresh();
    }

    public function delete(TransactionCategory $category): void
    {
        $this->guardSystem($category);

        $inUse = $category->parent_id === null
            ? Transaction::where('category', $category->name)->exists()
            : Transaction::where('subcategory', $category->name)->exists();

        if ($inUse) {
            throw ValidationException::withMessages([
                'category' => ['Impossible de supprimer cette catégorie car elle est utilisée par des transactions.'],
            ]);
        }

        $category->delete();
    }

    private function guardSystem(TransactionCategory $category): void
    {
        if ($category->is_system) {
            throw ValidationException::withMessages([
                'category' => ['Cette catégorie système ne peut pas être modifiée ou supprimée.'],
            ]);
        }
    }

    private function guardParentDepth(?int $parentId, string $type): void
    {
        if ($parentId === null) {
            return;
        }

        $parent = TransactionCategory::find($parentId);

        if (! $parent) {
            return; // FormRequest already validates exists:transaction_categories,id
        }

        if ($parent->parent_id !== null) {
            throw ValidationException::withMessages([
                'parent_id' => ['Une sous-catégorie ne peut pas avoir de sous-catégorie.'],
            ]);
        }

        if ($parent->type !== $type) {
            throw ValidationException::withMessages([
                'parent_id' => ['La sous-catégorie doit avoir le même type (revenu/dépense) que sa catégorie parente.'],
            ]);
        }
    }
}
