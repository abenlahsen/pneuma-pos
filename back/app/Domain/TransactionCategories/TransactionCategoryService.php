<?php

namespace App\Domain\TransactionCategories;

use App\Models\Transaction;
use App\Models\TransactionCategory;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

class TransactionCategoryService
{
    public function list(?string $type = null, bool $onlyActive = false): Collection
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

        $category->update($validated);

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
