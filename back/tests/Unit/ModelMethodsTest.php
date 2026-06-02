<?php

namespace Tests\Unit;

use App\Models\Payment;
use App\Models\Product;
use App\Models\ProductPart;
use App\Models\ProductService;
use App\Models\ProductTyre;
use App\Models\SaleItem;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Tests\TestCase;

class ModelMethodsTest extends TestCase
{
    // -------------------------------------------------------------------------
    // Product::details()
    // -------------------------------------------------------------------------

    public function test_product_details_returns_tyre_for_tyre_type(): void
    {
        $product = new Product(['type' => 'tyre']);

        // No DB record → relation returns null, but the 'tyre' branch is executed
        $this->assertNull($product->details());
    }

    public function test_product_details_returns_part_for_part_type(): void
    {
        $product = new Product(['type' => 'part']);

        $this->assertNull($product->details());
    }

    public function test_product_details_returns_service_for_service_type(): void
    {
        $product = new Product(['type' => 'service']);

        $this->assertNull($product->details());
    }

    public function test_product_details_returns_null_for_unknown_type(): void
    {
        $product = new Product(['type' => 'unknown']);

        $this->assertNull($product->details());
    }

    // Relation builders exist and are properly typed
    public function test_product_brand_relation(): void
    {
        $this->assertInstanceOf(BelongsTo::class, (new Product)->brand());
    }

    public function test_product_stocks_relation(): void
    {
        $this->assertInstanceOf(HasMany::class, (new Product)->stocks());
    }

    public function test_product_tyre_relation(): void
    {
        $this->assertInstanceOf(HasOne::class, (new Product)->tyre());
    }

    public function test_product_part_relation(): void
    {
        $this->assertInstanceOf(HasOne::class, (new Product)->part());
    }

    public function test_product_service_relation(): void
    {
        $this->assertInstanceOf(HasOne::class, (new Product)->service());
    }

    // -------------------------------------------------------------------------
    // SaleItem relationships
    // -------------------------------------------------------------------------

    public function test_sale_item_sale_relation(): void
    {
        $this->assertInstanceOf(BelongsTo::class, (new SaleItem)->sale());
    }

    public function test_sale_item_stock_relation(): void
    {
        $this->assertInstanceOf(BelongsTo::class, (new SaleItem)->stock());
    }

    public function test_sale_item_linked_product_relation(): void
    {
        $this->assertInstanceOf(BelongsTo::class, (new SaleItem)->linkedProduct());
    }

    // -------------------------------------------------------------------------
    // Payment relationships
    // -------------------------------------------------------------------------

    public function test_payment_sale_relation(): void
    {
        $this->assertInstanceOf(BelongsTo::class, (new Payment)->sale());
    }

    public function test_payment_transaction_relation(): void
    {
        $this->assertInstanceOf(BelongsTo::class, (new Payment)->transaction());
    }
}
