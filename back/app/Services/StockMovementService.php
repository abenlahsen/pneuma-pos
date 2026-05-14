<?php

namespace App\Services;

use App\Models\Stock;
use App\Models\StockMovement;

class StockMovementService
{
    /**
     * @param  Stock  $stock
     * @param  int|null  $userId
     * @return void
     */
    public function recordAutoCreate($stock, $userId)
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

    /**
     * @param  Stock  $stock
     * @param  int|null  $userId
     * @return void
     */
    public function recordInitial($stock, $userId)
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

    /**
     * @param  Stock  $stock
     * @param  int  $qtyAfter
     * @param  int|null  $userId
     * @return void
     */
    public function recordImport($stock, $qtyAfter, $userId)
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

    /**
     * @param  Stock  $stock
     * @param  int  $before
     * @param  int  $after
     * @param  string  $reason
     * @param  int|null  $userId
     * @return void
     */
    public function recordAdjustment($stock, $before, $after, $reason, $userId)
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

    /**
     * @param  Stock  $stock
     * @param  int|null  $userId
     * @return void
     */
    public function recordDeletion($stock, $userId)
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

    /**
     * @param  int  $stockId
     * @param  int|null  $productId
     * @param  int  $before
     * @param  int  $after
     * @param  int  $saleId
     * @param  int|null  $userId
     * @return void
     */
    public function recordSaleOut($stockId, $productId, $before, $after, $saleId, $userId, ?string $reason = null)
    {
        $this->insert([
            'stock_id' => $stockId,
            'product_id' => $productId,
            'type' => StockMovement::TYPE_SALE_OUT,
            'quantity_before' => $before,
            'quantity_after' => $after,
            'delta' => $after - $before,
            'reference_type' => 'Vente',
            'reference_id' => $saleId,
            'reason' => $reason,
            'user_id' => $userId,
        ]);
    }

    /**
     * @param  int  $stockId
     * @param  int|null  $productId
     * @param  int  $before
     * @param  int  $after
     * @param  int  $saleId
     * @param  int|null  $userId
     * @return void
     */
    public function recordSaleIn($stockId, $productId, $before, $after, $saleId, $userId, ?string $reason = null)
    {
        $this->insert([
            'stock_id' => $stockId,
            'product_id' => $productId,
            'type' => StockMovement::TYPE_SALE_IN,
            'quantity_before' => $before,
            'quantity_after' => $after,
            'delta' => $after - $before,
            'reference_type' => 'Vente',
            'reference_id' => $saleId,
            'reason' => $reason,
            'user_id' => $userId,
        ]);
    }

    /**
     * @param  int  $stockId
     * @param  int|null  $productId
     * @param  int  $before
     * @param  int  $after
     * @param  int  $purchaseId
     * @param  int|null  $userId
     * @return void
     */
    public function recordPurchaseIn($stockId, $productId, $before, $after, $purchaseId, $userId, ?string $reason = null)
    {
        $this->insert([
            'stock_id' => $stockId,
            'product_id' => $productId,
            'type' => StockMovement::TYPE_PURCHASE_IN,
            'quantity_before' => $before,
            'quantity_after' => $after,
            'delta' => $after - $before,
            'reference_type' => 'Achat',
            'reference_id' => $purchaseId,
            'reason' => $reason,
            'user_id' => $userId,
        ]);
    }

    /**
     * @param  int  $stockId
     * @param  int|null  $productId
     * @param  int  $before
     * @param  int  $after
     * @param  int  $purchaseId
     * @param  int|null  $userId
     * @return void
     */
    public function recordPurchaseOut($stockId, $productId, $before, $after, $purchaseId, $userId, ?string $reason = null)
    {
        $this->insert([
            'stock_id' => $stockId,
            'product_id' => $productId,
            'type' => StockMovement::TYPE_PURCHASE_OUT,
            'quantity_before' => $before,
            'quantity_after' => $after,
            'delta' => $after - $before,
            'reference_type' => 'Achat',
            'reference_id' => $purchaseId,
            'reason' => $reason,
            'user_id' => $userId,
        ]);
    }

    public function recordServiceOut($stockId, $productId, $before, $after, $serviceOrderId, $userId, ?string $reason = null)
    {
        $this->insert([
            'stock_id' => $stockId,
            'product_id' => $productId,
            'type' => StockMovement::TYPE_SERVICE_OUT,
            'quantity_before' => $before,
            'quantity_after' => $after,
            'delta' => $after - $before,
            'reference_type' => 'Service Auto',
            'reference_id' => $serviceOrderId,
            'reason' => $reason,
            'user_id' => $userId,
        ]);
    }

    public function recordServiceIn($stockId, $productId, $before, $after, $serviceOrderId, $userId, ?string $reason = null)
    {
        $this->insert([
            'stock_id' => $stockId,
            'product_id' => $productId,
            'type' => StockMovement::TYPE_SERVICE_IN,
            'quantity_before' => $before,
            'quantity_after' => $after,
            'delta' => $after - $before,
            'reference_type' => 'Service Auto',
            'reference_id' => $serviceOrderId,
            'reason' => $reason,
            'user_id' => $userId,
        ]);
    }

    /**
     * @param  array<string, mixed>  $attributes
     * @return void
     */
    private function insert($attributes)
    {
        StockMovement::create($attributes);
    }
}