<?php

namespace App\Models\Concerns;

use App\Support\Helpers\PaymentMethods;

/**
 * Exposes `payment_methods` — the distinct methods of the payments actually
 * recorded against this operation (a Sale or a Purchase).
 *
 * Derived from `allocations()` and NEVER from the legacy `payments()` relation:
 * a client payment covering several sales (or a supplier payment covering
 * several purchases) leaves `sale_id` / `purchase_id` null and is only
 * reachable through the allocation rows.
 *
 * List queries MUST eager-load `allocations.payment`. The `loadMissing` below
 * is a correctness net (one batched query per collection, not per row), not a
 * licence to skip the eager load.
 *
 * @property-read array<int, string> $payment_methods
 */
trait AggregatesPaymentMethods
{
    /**
     * @return array<int, string>
     */
    public function getPaymentMethodsAttribute(): array
    {
        $allocations = $this->relationLoaded('allocations')
            ? $this->getRelation('allocations')->loadMissing('payment')
            : $this->allocations()->with('payment')->get();

        return PaymentMethods::distinct(
            $allocations->map(fn ($allocation) => $allocation->payment?->method)
        );
    }
}
