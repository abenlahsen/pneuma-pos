<?php

namespace Tests\Unit;

use App\Enums\SaleStatus;
use App\Support\Helpers\PaymentMethods;
use App\Support\MultiValueFilter;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class MultiValueFilterTest extends TestCase
{
    private function allowed(): array
    {
        return SaleStatus::values();
    }

    public function test_null_or_empty_means_no_filter(): void
    {
        $this->assertSame([], MultiValueFilter::parse(null, $this->allowed()));
        $this->assertSame([], MultiValueFilter::parse('', $this->allowed()));
        $this->assertSame([], MultiValueFilter::parse(' , ', $this->allowed()));
        $this->assertSame([], MultiValueFilter::parse([], $this->allowed()));
    }

    public function test_single_value_keeps_its_former_meaning(): void
    {
        $this->assertSame(['LIVRE'], MultiValueFilter::parse('LIVRE', $this->allowed()));
    }

    public function test_comma_separated_list_is_trimmed_and_deduplicated(): void
    {
        $this->assertSame(
            ['EN COURS', 'LIVRE'],
            MultiValueFilter::parse(' EN COURS ,LIVRE,,EN COURS', $this->allowed())
        );
    }

    public function test_array_is_accepted(): void
    {
        $this->assertSame(['MONTE', 'ANNULE'], MultiValueFilter::parse(['MONTE', 'ANNULE'], $this->allowed()));
    }

    public function test_unknown_value_is_refused(): void
    {
        $this->expectException(ValidationException::class);

        MultiValueFilter::parse('LIVRE,FOO', $this->allowed());
    }

    public function test_accented_payment_methods_are_accepted(): void
    {
        $this->assertSame(
            ['Chèque', 'Espèces'],
            MultiValueFilter::parse('Chèque,Espèces', PaymentMethods::VOCABULARY, 'payment_method', 'Mode de paiement')
        );
    }

    public function test_error_names_the_field_and_its_label(): void
    {
        try {
            MultiValueFilter::parse('Chèque,TPE', PaymentMethods::VOCABULARY, 'payment_method', 'Mode de paiement');
            $this->fail('A method outside the vocabulary must be refused.');
        } catch (ValidationException $e) {
            $this->assertSame(['payment_method' => ['Mode de paiement inconnu : TPE.']], $e->errors());
        }
    }
}
