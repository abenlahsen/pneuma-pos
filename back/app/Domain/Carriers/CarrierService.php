<?php

namespace App\Domain\Carriers;

use App\Http\Resources\Carriers\CarrierResource;
use App\Models\Carrier;
use App\Models\User;
use Illuminate\Pagination\LengthAwarePaginator;

class CarrierService
{
    /**
     * @param  array<string, mixed>  $filters
     * @return array<int, mixed>|array<string, mixed>
     */
    public function list(array $filters = [])
    {
        $query = Carrier::query();

        $sortable = ['name', 'phone', 'email', 'created_at'];
        if (! empty($filters['sort_by']) && in_array($filters['sort_by'], $sortable)) {
            $direction = ($filters['sort_direction'] ?? 'asc') === 'desc' ? 'desc' : 'asc';
            $query->orderBy($filters['sort_by'], $direction);
        } else {
            $query->latest('created_at');
        }

        if (! empty($filters['search'])) {
            $search = $filters['search'];
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%");
            });
        }

        if (filter_var($filters['all'] ?? false, FILTER_VALIDATE_BOOLEAN)) {
            return CarrierResource::collection($query->get())->resolve();
        }

        $paginated = $query->paginate($filters['per_page'] ?? 20);

        return $this->formatPaginatedResponse($paginated);
    }

    /**
     * @param  array<string, mixed>  $validated
     * @param  User  $user
     * @return Carrier
     */
    public function create(array $validated, $user)
    {
        return Carrier::create(array_merge(
            $validated,
            ['user_id' => $user->id]
        ));
    }

    /**
     * @param  Carrier  $carrier
     * @param  array<string, mixed>  $validated
     * @return Carrier
     */
    public function update($carrier, array $validated)
    {
        $carrier->update($validated);

        return $carrier->fresh();
    }

    /**
     * @param  Carrier  $carrier
     * @return void
     */
    public function delete($carrier)
    {
        $carrier->delete();
    }

    /**
     * @return array<string, mixed>
     */
    private function formatPaginatedResponse(LengthAwarePaginator $paginated): array
    {
        return [
            'current_page' => $paginated->currentPage(),
            'data' => CarrierResource::collection($paginated->items())->resolve(),
            'first_page_url' => $paginated->url(1),
            'from' => $paginated->firstItem(),
            'last_page' => $paginated->lastPage(),
            'last_page_url' => $paginated->url($paginated->lastPage()),
            'links' => $paginated->linkCollection()->toArray(),
            'next_page_url' => $paginated->nextPageUrl(),
            'path' => $paginated->path(),
            'per_page' => $paginated->perPage(),
            'prev_page_url' => $paginated->previousPageUrl(),
            'to' => $paginated->lastItem(),
            'total' => $paginated->total(),
        ];
    }
}