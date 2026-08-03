<?php

namespace Tests\Unit;

use App\Support\Helpers\PaymentMethods;
use Tests\TestCase;

class PaymentMethodsTest extends TestCase
{
    public function test_distinct_returns_canonical_order_not_insertion_order(): void
    {
        $this->assertSame(
            ['Espèces', 'Chèque', 'Virement', 'Effet', 'Carte bancaire'],
            PaymentMethods::distinct(['Effet', 'Carte bancaire', 'Virement', 'Chèque', 'Espèces'])
        );
    }

    public function test_distinct_dedupes_repeated_values(): void
    {
        $this->assertSame(
            ['Chèque'],
            PaymentMethods::distinct(['Chèque', 'Chèque', 'Chèque'])
        );
    }

    public function test_distinct_filters_null_empty_and_whitespace_only(): void
    {
        $this->assertSame(
            ['Espèces'],
            PaymentMethods::distinct(['Espèces', null, '', '   '])
        );
    }

    public function test_distinct_returns_empty_array_for_empty_input(): void
    {
        $this->assertSame([], PaymentMethods::distinct([]));
    }

    public function test_distinct_returns_empty_array_when_all_values_are_blank(): void
    {
        $this->assertSame([], PaymentMethods::distinct([null, '', '  ']));
    }

    public function test_distinct_appends_unknown_legacy_values_after_known_ones(): void
    {
        $this->assertSame(
            ['Espèces', 'TPE'],
            PaymentMethods::distinct(['TPE', 'Espèces'])
        );
    }

    public function test_distinct_sorts_multiple_unknown_values_alphabetically(): void
    {
        $this->assertSame(
            ['TPE', 'TRAITE'],
            PaymentMethods::distinct(['TRAITE', 'TPE'])
        );
    }

    public function test_distinct_trims_surrounding_whitespace(): void
    {
        $this->assertSame(
            ['Espèces'],
            PaymentMethods::distinct(['  Espèces  '])
        );
    }
}
