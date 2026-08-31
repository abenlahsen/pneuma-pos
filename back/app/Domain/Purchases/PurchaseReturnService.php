<?php

namespace App\Domain\Purchases;

use App\Enums\PurchaseStatus;
use App\Models\Purchase;
use App\Models\PurchaseReturn;
use App\Models\PurchaseReturnItem;
use App\Models\Stock;
use App\Models\Transaction;
use App\Models\User;
use App\Services\ActivityLogService;
use App\Services\StockMovementService;
use App\Support\Helpers\ProductLabel;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Handles supplier returns on a purchase (partial or total): decrements the
 * stock the return items came from, optionally records a cash refund back
 * onto the account that took the original payment, and closes the purchase
 * (ANNULE) once every line has been fully returned. Mirrors PurchaseService's
 * shape (same collaborators) but is kept separate since it addresses a
 * distinct operation, not a purchase CRUD variant.
 */
class PurchaseReturnService
{
    public function __construct(
        private StockMovementService $movements,
        private ActivityLogService $activityLog,
        private PurchasePaymentService $purchasePayments,
    ) {}

    public function listForPurchase(Purchase $purchase)
    {
        return $purchase->returns()
            ->with([
                'items.linkedProduct.brand',
                'items.linkedProduct.tyre',
                'refundTransaction.account',
                'creator',
            ])
            ->latest('date')
            ->latest('id')
            ->get();
    }

    /**
     * @param  array<string, mixed>  $validated
     */
    public function create(Purchase $purchase, array $validated, User $user): PurchaseReturn
    {
        if ($purchase->status === PurchaseStatus::ANNULE->value) {
            throw ValidationException::withMessages([
                'purchase' => ['Cet achat est déjà annulé.'],
            ]);
        }

        $purchase->loadMissing(['items', 'supplier']);
        $itemsById = $purchase->items->keyBy('id');

        // Group by purchase_item_id first so two rows for the same line in
        // one request can't each pass the remainingQuantity() check on their
        // own while together exceeding it.
        $requested = [];
        foreach ($validated['items'] as $row) {
            $itemId = (int) $row['purchase_item_id'];
            $requested[$itemId] = ($requested[$itemId] ?? 0) + (int) $row['quantity'];
        }

        $lines = [];
        foreach ($requested as $itemId => $quantity) {
            $item = $itemsById->get($itemId);
            if (! $item) {
                throw ValidationException::withMessages([
                    'items' => ["La ligne #{$itemId} n'appartient pas à cet achat."],
                ]);
            }

            $remaining = $item->remainingQuantity();
            if ($quantity > $remaining) {
                $label = ProductLabel::format($item->linkedProduct, 'Produit #'.$item->product_id);
                throw ValidationException::withMessages([
                    'items' => ["{$label} : quantité à retourner ({$quantity}) supérieure à la quantité restante ({$remaining})."],
                ]);
            }

            $lines[] = ['item' => $item, 'quantity' => $quantity];
        }

        if (empty($lines)) {
            throw ValidationException::withMessages([
                'items' => ['Aucune ligne à retourner.'],
            ]);
        }

        // Stock availability — accumulate every shortage so the user sees the
        // whole problem in one message instead of fixing one line at a time.
        $shortages = [];
        foreach ($lines as $line) {
            $item = $line['item'];
            if (! $item->stock_id) {
                continue;
            }

            $stock = Stock::find($item->stock_id);
            $available = $stock ? (int) $stock->quantity : 0;
            if ($line['quantity'] > $available) {
                $label = ProductLabel::format($item->linkedProduct, 'Produit #'.$item->product_id);
                $shortages[] = "{$label} : {$line['quantity']} demandés, {$available} disponible(s).";
            }
        }

        if (! empty($shortages)) {
            throw ValidationException::withMessages([
                'items' => ['Stock insuffisant pour retourner ces articles : '.implode(' ', $shortages)],
            ]);
        }

        $refund = $validated['refund'] ?? null;
        if ($refund) {
            $availableToRefund = round($purchase->paidAmount() - $purchase->refundedAmount(), 2);
            if (round((float) $refund['amount'], 2) - $availableToRefund > 0.01) {
                throw ValidationException::withMessages([
                    'refund' => ["Le montant du remboursement ({$refund['amount']} DH) dépasse ce qui a été payé et non encore remboursé ({$availableToRefund} DH)."],
                ]);
            }
        }

        return DB::transaction(function () use ($purchase, $validated, $lines, $refund, $user) {
            $supplierName = $purchase->supplier?->name ?? null;

            $return = PurchaseReturn::create([
                'purchase_id' => $purchase->id,
                'date' => $validated['date'],
                'reason' => $validated['reason'] ?? null,
                'total_quantity' => 0,
                'total_amount' => 0,
                'refund_amount' => 0,
                'created_by' => $user->id,
            ]);

            $totalQuantity = 0;
            $totalAmount = 0.0;
            $logLines = [];

            foreach ($lines as $line) {
                $item = $line['item'];
                $quantity = $line['quantity'];
                $unitPrice = (float) $item->unit_price;
                $totalQuantity += $quantity;
                $totalAmount += round($quantity * $unitPrice, 2);

                PurchaseReturnItem::create([
                    'purchase_return_id' => $return->id,
                    'purchase_item_id' => $item->id,
                    'product_id' => $item->product_id,
                    'stock_id' => $item->stock_id,
                    'quantity' => $quantity,
                    'unit_price' => $unitPrice,
                ]);

                if ($item->stock_id) {
                    $stock = Stock::lockForUpdate()->find($item->stock_id);
                    if ($stock) {
                        $before = (int) $stock->quantity;
                        $stock->quantity = $before - $quantity;
                        $stock->save();

                        $reason = "Retour achat #{$purchase->id}".($supplierName ? " — {$supplierName}" : '');
                        $this->movements->recordPurchaseOut(
                            $stock->id,
                            $stock->product_id,
                            $before,
                            (int) $stock->quantity,
                            $purchase->id,
                            $user->id,
                            $reason
                        );
                    }
                }

                $logLines[] = [
                    'label' => ProductLabel::format($item->linkedProduct, 'Produit #'.$item->product_id),
                    'quantity' => $quantity,
                ];
            }

            $totalAmount = round($totalAmount, 2);
            $refundAmount = 0.0;
            $refundTransactionId = null;

            if ($refund) {
                $refundAmount = round((float) $refund['amount'], 2);
                $transaction = Transaction::create([
                    'date' => $refund['date'],
                    'amount' => $refundAmount,
                    'type' => 'income',
                    'category' => 'Remboursement fournisseur',
                    'method' => $refund['method'],
                    'description' => "Remboursement retour achat #{$purchase->id}".($supplierName ? " — {$supplierName}" : ''),
                    'person' => $supplierName ?? '',
                    'user_id' => $user->id,
                    'account_id' => $refund['account_id'],
                ]);
                $refundTransactionId = $transaction->id;
            }

            $return->update([
                'total_quantity' => $totalQuantity,
                'total_amount' => $totalAmount,
                'refund_amount' => $refundAmount,
                'refund_transaction_id' => $refundTransactionId,
            ]);

            $purchase->increment('returned_quantity', $totalQuantity);
            $purchase->increment('returned_amount', $totalAmount);
            $purchase->refresh();

            // Close the purchase once every line has nothing left to return —
            // a partial return leaves the status untouched.
            $purchase->load('items');
            $fullyReturned = $purchase->items->every(fn ($item) => $item->remainingQuantity() === 0);
            if ($fullyReturned && $purchase->status !== PurchaseStatus::ANNULE->value) {
                $purchase->update(['status' => PurchaseStatus::ANNULE->value]);
            }

            $this->purchasePayments->refreshPaymentStatus($purchase);

            $this->activityLog->logPurchaseReturnAdded(
                $purchase->fresh(),
                $totalQuantity,
                $totalAmount,
                $refundAmount,
                $logLines,
                $user->id,
                $user->name,
            );

            return $return->fresh()->load([
                'items.linkedProduct.brand',
                'items.linkedProduct.tyre',
                'refundTransaction.account',
            ]);
        });
    }

    public function delete(PurchaseReturn $return, ?int $userId = null, ?string $userName = null): void
    {
        $return->load(['items', 'purchase.items', 'purchase.supplier']);
        $purchase = $return->purchase;

        DB::transaction(function () use ($return, $purchase, $userId, $userName) {
            $supplierName = $purchase->supplier?->name ?? null;
            $quantity = $return->total_quantity;
            $amount = (float) $return->total_amount;
            $refundAmount = (float) $return->refund_amount;

            foreach ($return->items as $line) {
                if (! $line->stock_id) {
                    continue;
                }

                $stock = Stock::lockForUpdate()->find($line->stock_id);
                if (! $stock) {
                    continue;
                }

                $before = (int) $stock->quantity;
                $stock->quantity = $before + (int) $line->quantity;
                $stock->save();

                $reason = "Annulation retour achat #{$purchase->id}".($supplierName ? " — {$supplierName}" : '');
                $this->movements->recordPurchaseIn(
                    $stock->id,
                    $stock->product_id,
                    $before,
                    (int) $stock->quantity,
                    $purchase->id,
                    $userId,
                    $reason
                );
            }

            if ($return->refund_transaction_id) {
                Transaction::where('id', $return->refund_transaction_id)->delete();
            }

            // Cascades the purchase_return_items rows — must happen before the
            // remainingQuantity() recheck below, which queries them live.
            $return->delete();

            $purchase->decrement('returned_quantity', $quantity);
            $purchase->decrement('returned_amount', $amount);
            $purchase->refresh();

            // Reopen a purchase this return had closed out. The purchase's
            // status before that auto-close isn't tracked, so it reopens to
            // RECU (the standard "goods in hand" state) rather than whatever
            // it was before — matches the documented reopen behaviour.
            if ($purchase->status === PurchaseStatus::ANNULE->value) {
                $purchase->load('items');
                $stillFullyReturned = $purchase->items->isNotEmpty()
                    && $purchase->items->every(fn ($item) => $item->remainingQuantity() === 0);

                if (! $stillFullyReturned) {
                    $purchase->update(['status' => PurchaseStatus::RECU->value]);
                }
            }

            $this->purchasePayments->refreshPaymentStatus($purchase);

            $this->activityLog->logPurchaseReturnDeleted(
                $purchase->fresh(),
                $quantity,
                $amount,
                $refundAmount,
                $userId,
                $userName,
            );
        });
    }
}
