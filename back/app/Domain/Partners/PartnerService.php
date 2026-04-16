<?php

namespace App\Domain\Partners;

use App\Models\Partner;
use App\Models\User;

class PartnerService
{
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