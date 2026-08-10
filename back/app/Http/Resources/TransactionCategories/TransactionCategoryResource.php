<?php

namespace App\Http\Resources\TransactionCategories;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TransactionCategoryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'type' => $this->type,
            'parent_id' => $this->parent_id,
            'is_system' => (bool) $this->is_system,
            'is_active' => (bool) $this->is_active,
            'counts_as_expense' => (bool) $this->counts_as_expense,
            'counts_as_revenue' => (bool) $this->counts_as_revenue,
            'sort_order' => $this->sort_order,
            'children' => $this->whenLoaded('children', fn () => TransactionCategoryResource::collection($this->children)->resolve()),
        ];
    }
}
