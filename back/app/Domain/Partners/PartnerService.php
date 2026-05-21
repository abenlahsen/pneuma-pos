<?php

namespace App\Domain\Partners;

use App\Models\City;
use App\Models\Partner;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;

class PartnerService
{
    /**
     * @param  array<string, mixed>  $filters
     * @return Collection<int, Partner>|LengthAwarePaginator
     */
    public function list(array $filters = [])
    {
        $query = Partner::query();

        if (! empty($filters['search'])) {
            $search = $filters['search'];
            $query->where(function (Builder $q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhereHas('cityRelation', fn (Builder $q2) => $q2->where('name', 'like', "%{$search}%"))
                    ->orWhere('phone', 'like', "%{$search}%")
                    ->orWhere('mobile', 'like', "%{$search}%");
            });
        }

        if (! empty($filters['city'])) {
            $cityId = City::where('name', $filters['city'])->value('id');
            if ($cityId) {
                $query->where('city_id', $cityId);
            }
        }

        $sortable = ['name', 'city', 'phone', 'mobile', 'created_at'];
        if (! empty($filters['sort_by']) && in_array($filters['sort_by'], $sortable, true)) {
            $direction = ($filters['sort_direction'] ?? 'asc') === 'desc' ? 'desc' : 'asc';
            $query->orderBy($filters['sort_by'], $direction);
        } else {
            $query->latest('created_at');
        }

        if (filter_var($filters['all'] ?? false, FILTER_VALIDATE_BOOLEAN)) {
            return $query->with('cityRelation')->get();
        }

        return $query->with('cityRelation')->paginate((int) ($filters['per_page'] ?? 20));
    }

    /**
     * @param  array<string, mixed>  $validated
     * @param  User  $user
     * @return Partner
     */
    public function create(array $validated, $user)
    {
        return Partner::create(array_merge(
            $validated,
            ['user_id' => $user->id]
        ));
    }

    /**
     * @param  Partner  $partner
     * @param  array<string, mixed>  $validated
     * @return Partner
     */
    public function update($partner, array $validated)
    {
        $partner->update($validated);

        return $partner->fresh();
    }

    /**
     * @param  Partner  $partner
     * @return void
     */
    public function delete($partner)
    {
        $partner->delete();
    }
}
