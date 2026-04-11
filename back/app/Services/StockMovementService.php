<?php

namespace App\Services;

use App\Models\Purchase;
use App\Models\Sale;
use App\Models\Stock;
use App\Models\StockMovement;

class StockMovementService
{
    public function recordAutoCreate(Stock $stock, ?int $userId): void
    {
        $this->insert([
            'stock_id' => $stock->id,
            'product_id' => $stock->product_id,
            'type' => StockMovement::TYPE_AUTO_CREATE,
            'quantity_before' => 0,
            'quantity_after' => 0,
            'delta' => 0,
            'user_id' => $userId,
        ]);
    }

    public function recordInitial(Stock $stock, ?int $userId): void
    {
        $after = (int) $stock->quantity;

        $this->insert([
            'stock_id' => $stock->id,
            'product_id' => $stock->product_id,
            'type' => StockMovement::TYPE_INITIAL,
            'quantity_before' => 0,
            'quantity_after' => $after,
            'delta' => $after,
            'user_id' => $userId,
        ]);
    }

    public function recordImport(Stock $stock, int $qtyAfter, ?int $userId): void
    {
        $this->insert([
            'stock_id' => $stock->id,
            'product_id' => $stock->product_id,
            'type' => StockMovement::TYPE_IMPORT,
            'quantity_before' => 0,
            'quantity_after' => $qtyAfter,
            'delta' => $qtyAfter,
            'reference_type' => 'Import',
            'user_id' => $userId,
        ]);
    }

    public function recordAdjustment(Stock $stock, int $before, int $after, string $reason, ?int $userId): void
    {
        $this->insert([
            'stock_id' => $stock->id,
            'product_id' => $stock->product_id,
            'type' => StockMovement::TYPE_ADJUSTMENT,
            'quantity_before' => $before,
            'quantity_after' => $after,
            'delta' => $after - $before,
            'reason' => $reason,
            'user_id' => $userId,
        ]);
    }

    public function recordDeletion(Stock $stock, ?int $userId): void
    {
        $before = (int) $stock->quantity;

        $this->insert([
            'stock_id' => $stock->id,
            'product_id' => $stock->product_id,
            'type' => StockMovement::TYPE_DELETION,
            'quantity_before' => $before,
            'quantity_after' => 0,
            'delta' => -$before,
            'user_id' => $userId,
        ]);
    }

    public function recordSaleOut(int $stockId, ?int $productId, int $before, int $after, int $saleId, ?int $userId): void
    {
        $this->insert([
            'stock_id' => $stockId,
            'product_id' => $productId,
            'type' => StockMovement::TYPE_SALE_OUT,
            'quantity_before' => $before,
            'quantity_after' => $after,
            'delta' => $after - $before,
            'reference_type' => Sale::class,
            'reference_id' => $saleId,
            'user_id' => $userId,
        ]);
    }

    public function recordSaleIn(int $stockId, ?int $productId, int $before, int $after, int $saleId, ?int $userId): void
    {
        $this->insert([
            'stock_id' => $stockId,
            'product_id' => $productId,
            'type' => StockMovement::TYPE_SALE_IN,
            'quantity_before' => $before,
            'quantity_after' => $after,
            'delta' => $after - $before,
            'reference_type' => Sale::class,
            'reference_id' => $saleId,
            'user_id' => $userId,
        ]);
    }

    public function recordPurchaseIn(int $stockId, ?int $productId, int $before, int $after, int $purchaseId, ?int $userId): void
    {
        $this->insert([
            'stock_id' => $stockId,
            'product_id' => $productId,
            'type' => StockMovement::TYPE_PURCHASE_IN,
            'quantity_before' => $before,
            'quantity_after' => $after,
            'delta' => $after - $before,
            'reference_type' => Purchase::class,
            'reference_id' => $purchaseId,
            'user_id' => $userId,
        ]);
    }

    public function recordPurchaseOut(int $stockId, ?int $productId, int $before, int $after, int $purchaseId, ?int $userId): void
    {
        $this->insert([
            'stock_id' => $stockId,
            'product_id' => $productId,
            'type' => StockMovement::TYPE_PURCHASE_OUT,
            'quantity_before' => $before,
            'quantity_after' => $after,
            'delta' => $after - $before,
            'reference_type' => Purchase::class,
            'reference_id' => $purchaseId,
            'user_id' => $userId,
        ]);
    }

    private function insert(array $attributes): void
    {
        StockMovement::create($attributes);
    }
}
