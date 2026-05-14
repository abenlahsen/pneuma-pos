<?php

namespace App\Domain\ServiceOrders;

use App\Models\ServiceOrder;
use App\Models\Stock;
use App\Services\StockMovementService;

class StockDeductionService
{
    public function __construct(private StockMovementService $movementService) {}

    public function deductForOrder(ServiceOrder $order, ?int $userId): void
    {
        foreach ($order->items()->where('item_type', 'part')->get() as $item) {
            if (! $item->product_id || ! $item->quantity) {
                continue;
            }

            $stock = Stock::where('product_id', $item->product_id)
                ->where('quantity', '>', 0)
                ->orderByDesc('quantity')
                ->first();

            if (! $stock) {
                continue;
            }

            $before = (int) $stock->quantity;
            $deduct = min($before, (int) $item->quantity);
            $after = $before - $deduct;

            $stock->decrement('quantity', $deduct);

            $item->updateQuietly(['stock_id' => $stock->id]);

            $clientName = $order->client_id ? ($order->clientRecord?->name ?? null) : null;
            $reason = "Ordre #{$order->id} — {$order->vehicle}" . ($clientName ? " ({$clientName})" : '');
            $this->movementService->recordServiceOut(
                $stock->id,
                $item->product_id,
                $before,
                $after,
                $order->id,
                $userId,
                $reason
            );
        }
    }

    public function restoreForOrder(ServiceOrder $order, ?int $userId): void
    {
        foreach ($order->items()->where('item_type', 'part')->whereNotNull('stock_id')->get() as $item) {
            $stock = Stock::find($item->stock_id);
            if (! $stock) {
                continue;
            }

            $before = (int) $stock->quantity;
            $after = $before + (int) $item->quantity;
            $stock->increment('quantity', (int) $item->quantity);

            $clientName = $order->client_id ? ($order->clientRecord?->name ?? null) : null;
            $reason = "Ordre #{$order->id} — {$order->vehicle}" . ($clientName ? " ({$clientName})" : '');
            $this->movementService->recordServiceIn(
                $stock->id,
                $item->product_id,
                $before,
                $after,
                $order->id,
                $userId,
                $reason
            );
        }
    }
}
