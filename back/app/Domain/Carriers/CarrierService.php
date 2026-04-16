<?php

namespace App\Domain\Carriers;

use App\Models\Carrier;
use App\Models\User;

class CarrierService
{
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
}