<?php

namespace Tests\Unit;

use App\Enums\ClientCategory;
use App\Enums\PurchasePaymentStatus;
use App\Enums\PurchaseStatus;
use App\Enums\SalePaymentStatus;
use App\Enums\SaleStatus;
use App\Enums\ServiceOrderPaymentStatus;
use App\Enums\ServiceOrderStatus;
use PHPUnit\Framework\TestCase;

class EnumsTest extends TestCase
{
    public function test_client_category_values(): void
    {
        $this->assertSame(['Particulier', 'Entreprise'], ClientCategory::values());
        $this->assertCount(2, ClientCategory::cases());
    }

    public function test_sale_status_values(): void
    {
        $this->assertSame(['EN COURS', 'LIVRE', 'MONTE', 'TERMINEE', 'ANNULE'], SaleStatus::values());
        $this->assertCount(5, SaleStatus::cases());
    }

    public function test_sale_payment_status_has_no_accent(): void
    {
        $values = SalePaymentStatus::values();
        $this->assertSame(['NON PAYE', 'PAYE', 'PARTIEL'], $values);
        $this->assertNotContains('NON PAYÉ', $values);
        $this->assertNotContains('PAYÉ', $values);
    }

    public function test_purchase_status_values(): void
    {
        $this->assertSame(['EN COURS', 'RECU', 'TERMINE', 'ANNULE', 'RETOUR'], PurchaseStatus::values());
        $this->assertCount(5, PurchaseStatus::cases());
    }

    public function test_purchase_payment_status_values(): void
    {
        $this->assertSame(['NON PAYE', 'PAYE', 'PARTIEL'], PurchasePaymentStatus::values());
    }

    public function test_sale_and_purchase_payment_statuses_are_identical(): void
    {
        $this->assertSame(SalePaymentStatus::values(), PurchasePaymentStatus::values());
    }

    public function test_service_order_status_values(): void
    {
        $this->assertSame(['EN COURS', 'TERMINE', 'ANNULE'], ServiceOrderStatus::values());
        $this->assertCount(3, ServiceOrderStatus::cases());
    }

    public function test_service_order_payment_status_values(): void
    {
        $this->assertSame(['NON PAYE', 'PAYE', 'PARTIEL'], ServiceOrderPaymentStatus::values());
    }

    public function test_all_payment_statuses_are_identical(): void
    {
        $this->assertSame(SalePaymentStatus::values(), ServiceOrderPaymentStatus::values());
        $this->assertSame(PurchasePaymentStatus::values(), ServiceOrderPaymentStatus::values());
    }
}
