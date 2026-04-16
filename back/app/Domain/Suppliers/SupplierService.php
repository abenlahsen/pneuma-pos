<?php

namespace App\Domain\Suppliers;

use App\Models\Supplier;
use App\Models\User;

class SupplierService
{
    /**
     * @param  array<string, mixed>  $validated
     * @param  User  $user
     * @return Supplier
     */
    public function create(array $validated, $user)
    {
        return Supplier::create(array_merge(
            $validated,
            ['user_id' => $user->id]
        ));
    }

    /**
     * @param  Supplier  $supplier
     * @param  array<string, mixed>  $validated
     * @return Supplier
     */
    public function update($supplier, array $validated)
    {
        $supplier->update($validated);

        return $supplier->fresh();
    }

    /**
     * @param  Supplier  $supplier
     * @return void
     */
    public function delete($supplier)
    {
        $supplier->delete();
    }
}