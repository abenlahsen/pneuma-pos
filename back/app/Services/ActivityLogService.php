<?php

namespace App\Services;

use App\Models\Account;
use App\Models\ActivityLog;
use App\Models\Purchase;
use App\Models\Sale;
use App\Models\ServiceOrder;
use App\Models\ShipmentChangeRequest;
use App\Models\Transaction;
use App\Models\TransactionCategory;
use App\Models\User;

class ActivityLogService
{
    // -------------------------------------------------------------------------
    // Snapshots
    // -------------------------------------------------------------------------

    public function buildSaleSnapshot(Sale $sale): array
    {
        $snapshot = [
            'date' => $sale->date ? (string) $sale->date : null,
            'status' => $sale->status,
            'payment_status' => $sale->payment_status,
            'total_sale' => (float) $sale->total_sale,
            'total_purchase' => (float) $sale->total_purchase,
            'total_quantity' => (int) $sale->total_quantity,
            'margin' => (float) $sale->margin,
            'with_invoice' => (bool) $sale->with_invoice,
            'client' => $sale->linkedClient?->name,
            'commercial' => $sale->commercial?->name,
            'carrier' => $sale->linkedCarrier?->name,
            'partner' => $sale->linkedPartner?->name,
        ];

        return array_filter($snapshot, fn ($v) => $v !== null && $v !== '');
    }

    public function buildPurchaseSnapshot(Purchase $purchase): array
    {
        $snapshot = [
            'date' => $purchase->date ? (string) $purchase->date : null,
            'status' => $purchase->status,
            'payment_status' => $purchase->payment_status,
            'net_amount' => (float) $purchase->net_amount,
            'total_quantity' => (int) $purchase->total_quantity,
            'with_invoice' => (bool) $purchase->with_invoice,
            'bl_number' => $purchase->bl_number,
            'invoice_number' => $purchase->invoice_number,
            'discount' => (float) $purchase->discount,
            'supplier' => $purchase->supplier?->name,
            'commercial' => $purchase->commercial?->name,
        ];

        return array_filter($snapshot, fn ($v) => $v !== null && $v !== '');
    }

    public function buildServiceOrderSnapshot(ServiceOrder $order): array
    {
        $snapshot = [
            'date' => $order->date ? (string) $order->date : null,
            'status' => $order->status,
            'payment_status' => $order->payment_status,
            'net_amount' => (float) $order->net_amount,
            'total_amount' => (float) $order->total_amount,
            'discount' => (float) $order->discount,
            'vehicle' => $order->vehicle,
            'mileage' => $order->mileage ? (int) $order->mileage : null,
            'notes' => $order->notes,
            'client' => $order->clientRecord?->name,
            'commercial' => $order->commercial?->name,
        ];

        return array_filter($snapshot, fn ($v) => $v !== null && $v !== '');
    }

    public function buildShipmentChangeSnapshot(ShipmentChangeRequest $request): array
    {
        $snapshot = [
            'date' => $request->date ? (string) $request->date : null,
            'status' => $request->status,
            'shipment_number' => $request->shipment_number,
            'reason' => $request->reason,
            'sale_id' => $request->sale_id,
            'carrier' => $request->carrier?->name,
            'items_count' => $request->relationLoaded('items') ? $request->items->count() : null,
        ];

        return array_filter($snapshot, fn ($v) => $v !== null && $v !== '');
    }

    public function buildCompteSnapshot(Account $account): array
    {
        return array_filter([
            'name' => $account->name,
            'type' => $account->type,
            'description' => $account->description,
            'initial_balance' => (float) $account->initial_balance,
            'is_active' => (bool) $account->is_active,
        ], fn ($v) => $v !== null && $v !== '');
    }

    public function buildTransactionSnapshot(Transaction $transaction): array
    {
        return array_filter([
            'date' => $transaction->date ? (string) $transaction->date : null,
            'type' => $transaction->type,
            'amount' => (float) $transaction->amount,
            'category' => $transaction->category,
            'subcategory' => $transaction->subcategory,
            'method' => $transaction->method,
            'description' => $transaction->description,
            'person' => $transaction->person,
            'account' => $transaction->account?->name,
        ], fn ($v) => $v !== null && $v !== '');
    }

    // -------------------------------------------------------------------------
    // Ventes
    // -------------------------------------------------------------------------

    public function logSaleCreated(Sale $sale, array $snapshot, ?int $userId, ?string $userName): void
    {
        $qty = (int) $sale->total_quantity;
        $total = number_format((float) $sale->total_sale, 2, '.', ' ');
        $clientName = $snapshot['client'] ?? null;
        $desc = "Vente #{$sale->id} créée — {$qty} article(s), CA : {$total} MAD"
            .($clientName ? " — Client : {$clientName}" : '');

        $this->insert([
            'action' => ActivityLog::ACTION_CREATE,
            'entity_type' => ActivityLog::ENTITY_VENTE,
            'entity_id' => $sale->id,
            'entity_label' => "Vente #{$sale->id}",
            'description' => $desc,
            'properties' => ['before' => null, 'after' => $snapshot],
            'user_id' => $userId,
            'user_name' => $userName,
        ]);
    }

    public function logSaleUpdated(Sale $sale, array $before, array $after, ?int $userId, ?string $userName): void
    {
        $desc = "Vente #{$sale->id} modifiée";
        $desc .= $this->buildUpdateSuffix($before, $after);

        $this->insert([
            'action' => ActivityLog::ACTION_UPDATE,
            'entity_type' => ActivityLog::ENTITY_VENTE,
            'entity_id' => $sale->id,
            'entity_label' => "Vente #{$sale->id}",
            'description' => $desc,
            'properties' => ['before' => $before, 'after' => $after],
            'user_id' => $userId,
            'user_name' => $userName,
        ]);
    }

    public function logSaleDeleted(array $before, ?int $userId, ?string $userName): void
    {
        $total = number_format((float) ($before['total_sale'] ?? 0), 2, '.', ' ');
        $status = $before['payment_status'] ?? '';
        $id = $before['id'];
        $desc = "Vente #{$id} supprimée — CA : {$total} MAD ({$status})";

        $this->insert([
            'action' => ActivityLog::ACTION_DELETE,
            'entity_type' => ActivityLog::ENTITY_VENTE,
            'entity_id' => $id,
            'entity_label' => "Vente #{$id}",
            'description' => $desc,
            'properties' => ['before' => $before, 'after' => null],
            'user_id' => $userId,
            'user_name' => $userName,
        ]);
    }

    // -------------------------------------------------------------------------
    // Achats
    // -------------------------------------------------------------------------

    public function logPurchaseCreated(Purchase $purchase, array $snapshot, ?int $userId, ?string $userName): void
    {
        $qty = (int) $purchase->total_quantity;
        $total = number_format((float) $purchase->net_amount, 2, '.', ' ');
        $supplierName = $snapshot['supplier'] ?? null;
        $desc = "Achat #{$purchase->id} créé — {$qty} article(s), Montant : {$total} MAD"
            .($supplierName ? " — Fournisseur : {$supplierName}" : '');

        $this->insert([
            'action' => ActivityLog::ACTION_CREATE,
            'entity_type' => ActivityLog::ENTITY_ACHAT,
            'entity_id' => $purchase->id,
            'entity_label' => "Achat #{$purchase->id}",
            'description' => $desc,
            'properties' => ['before' => null, 'after' => $snapshot],
            'user_id' => $userId,
            'user_name' => $userName,
        ]);
    }

    public function logPurchaseUpdated(Purchase $purchase, array $before, array $after, ?int $userId, ?string $userName): void
    {
        $desc = "Achat #{$purchase->id} modifié";
        $desc .= $this->buildUpdateSuffix($before, $after);

        $this->insert([
            'action' => ActivityLog::ACTION_UPDATE,
            'entity_type' => ActivityLog::ENTITY_ACHAT,
            'entity_id' => $purchase->id,
            'entity_label' => "Achat #{$purchase->id}",
            'description' => $desc,
            'properties' => ['before' => $before, 'after' => $after],
            'user_id' => $userId,
            'user_name' => $userName,
        ]);
    }

    public function logPurchaseDeleted(array $before, ?int $userId, ?string $userName): void
    {
        $total = number_format((float) ($before['net_amount'] ?? 0), 2, '.', ' ');
        $status = $before['payment_status'] ?? '';
        $id = $before['id'];
        $desc = "Achat #{$id} supprimé — Montant : {$total} MAD ({$status})";

        $this->insert([
            'action' => ActivityLog::ACTION_DELETE,
            'entity_type' => ActivityLog::ENTITY_ACHAT,
            'entity_id' => $id,
            'entity_label' => "Achat #{$id}",
            'description' => $desc,
            'properties' => ['before' => $before, 'after' => null],
            'user_id' => $userId,
            'user_name' => $userName,
        ]);
    }

    // -------------------------------------------------------------------------
    // Service Auto
    // -------------------------------------------------------------------------

    public function logServiceOrderCreated(ServiceOrder $order, array $snapshot, ?int $userId, ?string $userName): void
    {
        $total = number_format((float) $order->net_amount, 2, '.', ' ');
        $clientName = $snapshot['client'] ?? null;
        $vehicle = $snapshot['vehicle'] ?? null;
        $desc = "Ordre de service #{$order->id} créé — {$total} MAD"
            .($clientName ? " — {$clientName}" : '')
            .($vehicle ? " — {$vehicle}" : '');

        $this->insert([
            'action' => ActivityLog::ACTION_CREATE,
            'entity_type' => ActivityLog::ENTITY_SERVICE_ORDER,
            'entity_id' => $order->id,
            'entity_label' => "Ordre de service #{$order->id}",
            'description' => $desc,
            'properties' => ['before' => null, 'after' => $snapshot],
            'user_id' => $userId,
            'user_name' => $userName,
        ]);
    }

    public function logServiceOrderUpdated(ServiceOrder $order, array $before, array $after, ?int $userId, ?string $userName): void
    {
        $desc = "Ordre de service #{$order->id} modifié";
        $desc .= $this->buildUpdateSuffix($before, $after);

        $this->insert([
            'action' => ActivityLog::ACTION_UPDATE,
            'entity_type' => ActivityLog::ENTITY_SERVICE_ORDER,
            'entity_id' => $order->id,
            'entity_label' => "Ordre de service #{$order->id}",
            'description' => $desc,
            'properties' => ['before' => $before, 'after' => $after],
            'user_id' => $userId,
            'user_name' => $userName,
        ]);
    }

    public function logServiceOrderDeleted(array $before, ?int $userId, ?string $userName): void
    {
        $total = number_format((float) ($before['net_amount'] ?? 0), 2, '.', ' ');
        $status = $before['payment_status'] ?? '';
        $id = $before['id'];
        $desc = "Ordre de service #{$id} supprimé — {$total} MAD ({$status})";

        $this->insert([
            'action' => ActivityLog::ACTION_DELETE,
            'entity_type' => ActivityLog::ENTITY_SERVICE_ORDER,
            'entity_id' => $id,
            'entity_label' => "Ordre de service #{$id}",
            'description' => $desc,
            'properties' => ['before' => $before, 'after' => null],
            'user_id' => $userId,
            'user_name' => $userName,
        ]);
    }

    // -------------------------------------------------------------------------
    // Demandes de modification d'expédition
    // -------------------------------------------------------------------------

    public function logShipmentChangeCreated(ShipmentChangeRequest $request, array $snapshot, ?int $userId, ?string $userName): void
    {
        $carrierName = $snapshot['carrier'] ?? null;
        $desc = "Demande de modification #{$request->id} créée pour la vente #{$request->sale_id}"
            .($carrierName ? " — {$carrierName}" : '');

        $this->insert([
            'action' => ActivityLog::ACTION_CREATE,
            'entity_type' => ActivityLog::ENTITY_SHIPMENT_CHANGE,
            'entity_id' => $request->id,
            'entity_label' => "Demande de modification #{$request->id}",
            'description' => $desc,
            'properties' => ['before' => null, 'after' => $snapshot],
            'user_id' => $userId,
            'user_name' => $userName,
        ]);
    }

    public function logShipmentChangeUpdated(ShipmentChangeRequest $request, array $before, array $after, ?int $userId, ?string $userName): void
    {
        $desc = "Demande de modification #{$request->id} modifiée";
        $desc .= $this->buildUpdateSuffix($before, $after);

        $this->insert([
            'action' => ActivityLog::ACTION_UPDATE,
            'entity_type' => ActivityLog::ENTITY_SHIPMENT_CHANGE,
            'entity_id' => $request->id,
            'entity_label' => "Demande de modification #{$request->id}",
            'description' => $desc,
            'properties' => ['before' => $before, 'after' => $after],
            'user_id' => $userId,
            'user_name' => $userName,
        ]);
    }

    public function logShipmentChangeDeleted(array $before, ?int $userId, ?string $userName): void
    {
        $id = $before['id'];
        $desc = "Demande de modification #{$id} supprimée";

        $this->insert([
            'action' => ActivityLog::ACTION_DELETE,
            'entity_type' => ActivityLog::ENTITY_SHIPMENT_CHANGE,
            'entity_id' => $id,
            'entity_label' => "Demande de modification #{$id}",
            'description' => $desc,
            'properties' => ['before' => $before, 'after' => null],
            'user_id' => $userId,
            'user_name' => $userName,
        ]);
    }

    // -------------------------------------------------------------------------
    // Comptes
    // -------------------------------------------------------------------------

    public function logCompteCreated(Account $account, array $snapshot, ?int $userId, ?string $userName): void
    {
        $type = $account->type ?? '';
        $desc = "Compte '{$account->name}' créé".($type ? " — {$type}" : '');

        $this->insert([
            'action' => ActivityLog::ACTION_CREATE,
            'entity_type' => ActivityLog::ENTITY_COMPTE,
            'entity_id' => $account->id,
            'entity_label' => "Compte '{$account->name}'",
            'description' => $desc,
            'properties' => ['before' => null, 'after' => $snapshot],
            'user_id' => $userId,
            'user_name' => $userName,
        ]);
    }

    public function logCompteUpdated(Account $account, array $before, array $after, ?int $userId, ?string $userName): void
    {
        $desc = "Compte '{$account->name}' modifié";
        $desc .= $this->buildUpdateSuffix($before, $after);

        $this->insert([
            'action' => ActivityLog::ACTION_UPDATE,
            'entity_type' => ActivityLog::ENTITY_COMPTE,
            'entity_id' => $account->id,
            'entity_label' => "Compte '{$account->name}'",
            'description' => $desc,
            'properties' => ['before' => $before, 'after' => $after],
            'user_id' => $userId,
            'user_name' => $userName,
        ]);
    }

    public function logCompteDeleted(array $before, ?int $userId, ?string $userName): void
    {
        $name = $before['name'] ?? '?';
        $desc = "Compte '{$name}' supprimé";

        $this->insert([
            'action' => ActivityLog::ACTION_DELETE,
            'entity_type' => ActivityLog::ENTITY_COMPTE,
            'entity_id' => 0,
            'entity_label' => "Compte '{$name}'",
            'description' => $desc,
            'properties' => ['before' => $before, 'after' => null],
            'user_id' => $userId,
            'user_name' => $userName,
        ]);
    }

    // -------------------------------------------------------------------------
    // Transactions
    // -------------------------------------------------------------------------

    public function logTransactionCreated(Transaction $transaction, array $snapshot, ?int $userId, ?string $userName): void
    {
        $amountFmt = number_format((float) $transaction->amount, 2, '.', ' ');
        $type = $transaction->type === 'income' ? 'Entrée' : 'Dépense';
        $category = $snapshot['category'] ?? '';
        $desc = "Transaction #{$transaction->id} créée — {$type}, {$amountFmt} MAD"
            .($category ? " ({$category})" : '');

        $this->insert([
            'action' => ActivityLog::ACTION_CREATE,
            'entity_type' => ActivityLog::ENTITY_TRANSACTION,
            'is_confidential' => $this->isConfidentialCategory($snapshot['category'] ?? null),
            'entity_id' => $transaction->id,
            'entity_label' => "Transaction #{$transaction->id}",
            'description' => $desc,
            'properties' => ['before' => null, 'after' => $snapshot],
            'user_id' => $userId,
            'user_name' => $userName,
        ]);
    }

    public function logTransactionUpdated(Transaction $transaction, array $before, array $after, ?int $userId, ?string $userName): void
    {
        $desc = "Transaction #{$transaction->id} modifiée";
        $desc .= $this->buildUpdateSuffix($before, $after);

        $this->insert([
            'action' => ActivityLog::ACTION_UPDATE,
            'entity_type' => ActivityLog::ENTITY_TRANSACTION,
            // A transaction moved *out of* a confidential category (or into
            // one) must stay masked either way, since the diff would still
            // reveal the payroll-side amount/person on the other end.
            'is_confidential' => $this->isConfidentialCategory($before['category'] ?? null)
                || $this->isConfidentialCategory($after['category'] ?? null),
            'entity_id' => $transaction->id,
            'entity_label' => "Transaction #{$transaction->id}",
            'description' => $desc,
            'properties' => ['before' => $before, 'after' => $after],
            'user_id' => $userId,
            'user_name' => $userName,
        ]);
    }

    public function logTransactionDeleted(array $before, ?int $userId, ?string $userName): void
    {
        $id = $before['id'];
        $amountFmt = number_format((float) ($before['amount'] ?? 0), 2, '.', ' ');
        $desc = "Transaction #{$id} supprimée — {$amountFmt} MAD";

        $this->insert([
            'action' => ActivityLog::ACTION_DELETE,
            'entity_type' => ActivityLog::ENTITY_TRANSACTION,
            'is_confidential' => $this->isConfidentialCategory($before['category'] ?? null),
            'entity_id' => $id,
            'entity_label' => "Transaction #{$id}",
            'description' => $desc,
            'properties' => ['before' => $before, 'after' => null],
            'user_id' => $userId,
            'user_name' => $userName,
        ]);
    }

    public function logTransferDone(string $sourceAccountName, string $destAccountName, float $amount, int $transactionId, ?int $userId, ?string $userName): void
    {
        $amountFmt = number_format($amount, 2, '.', ' ');
        $desc = "Transfert de {$amountFmt} MAD de '{$sourceAccountName}' vers '{$destAccountName}'";

        $this->insert([
            'action' => ActivityLog::ACTION_CREATE,
            'entity_type' => ActivityLog::ENTITY_TRANSACTION,
            'entity_id' => $transactionId,
            'entity_label' => "Transfert {$sourceAccountName} → {$destAccountName}",
            'description' => $desc,
            'properties' => [
                'source_account' => $sourceAccountName,
                'dest_account' => $destAccountName,
                'amount' => $amount,
            ],
            'user_id' => $userId,
            'user_name' => $userName,
        ]);
    }

    // -------------------------------------------------------------------------
    // Paiements (inchangé)
    // -------------------------------------------------------------------------

    public function logPaymentAdded(
        string $entityType,
        int $entityId,
        string $entityLabel,
        float $amount,
        string $method,
        ?string $reference,
        ?int $userId,
        ?string $userName
    ): void {
        $amountFmt = number_format($amount, 2, '.', ' ');

        if ($entityType === ActivityLog::ENTITY_VENTE) {
            $desc = "Paiement de {$amountFmt} MAD ajouté sur la Vente #{$entityId} ({$method})";
        } elseif ($entityType === ActivityLog::ENTITY_ACHAT) {
            $desc = "Paiement de {$amountFmt} MAD ajouté sur l'Achat #{$entityId} ({$method})";
        } else {
            $desc = "Paiement de {$amountFmt} MAD ajouté sur l'Ordre de service #{$entityId} ({$method})";
        }

        $this->insert([
            'action' => ActivityLog::ACTION_PAYMENT_ADD,
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'entity_label' => $entityLabel,
            'description' => $desc,
            'properties' => [
                'amount' => $amount,
                'method' => $method,
                'reference' => $reference,
            ],
            'user_id' => $userId,
            'user_name' => $userName,
        ]);
    }

    public function logPaymentDeleted(
        string $entityType,
        int $entityId,
        string $entityLabel,
        float $amount,
        string $method,
        ?int $userId,
        ?string $userName
    ): void {
        $amountFmt = number_format($amount, 2, '.', ' ');

        if ($entityType === ActivityLog::ENTITY_VENTE) {
            $desc = "Paiement de {$amountFmt} MAD supprimé de la Vente #{$entityId}";
        } elseif ($entityType === ActivityLog::ENTITY_ACHAT) {
            $desc = "Paiement de {$amountFmt} MAD supprimé de l'Achat #{$entityId}";
        } else {
            $desc = "Paiement de {$amountFmt} MAD supprimé de l'Ordre de service #{$entityId}";
        }

        $this->insert([
            'action' => ActivityLog::ACTION_PAYMENT_DELETE,
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'entity_label' => $entityLabel,
            'description' => $desc,
            'properties' => [
                'amount' => $amount,
                'method' => $method,
            ],
            'user_id' => $userId,
            'user_name' => $userName,
        ]);
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    public static function resolveUserName(?int $userId): ?string
    {
        if ($userId === null) {
            return null;
        }

        return User::find($userId)?->name;
    }

    private function buildUpdateSuffix(array $before, array $after): string
    {
        if (isset($after['status']) && ($before['status'] ?? null) !== $after['status']) {
            return ' — Statut : '.($before['status'] ?? '?')." → {$after['status']}";
        }

        if (isset($after['payment_status']) && ($before['payment_status'] ?? null) !== $after['payment_status']) {
            return ' — Paiement : '.($before['payment_status'] ?? '?')." → {$after['payment_status']}";
        }

        $totalKey = isset($after['total_sale']) ? 'total_sale'
            : (isset($after['net_amount']) ? 'net_amount'
            : (isset($after['amount']) ? 'amount' : null));
        if ($totalKey && isset($before[$totalKey]) && abs((float) $before[$totalKey] - (float) $after[$totalKey]) > 0.01) {
            $old = number_format((float) $before[$totalKey], 2, '.', ' ');
            $new = number_format((float) $after[$totalKey], 2, '.', ' ');

            return " — Montant : {$old} → {$new} MAD";
        }

        return '';
    }

    /**
     * Whether a transaction category snapshot value belongs to a
     * confidential category tree (e.g. 'Charges RH') — same source of
     * truth as Transaction::scopeVisible().
     */
    private function isConfidentialCategory(?string $category): bool
    {
        return $category !== null
            && in_array($category, TransactionCategory::confidentialNames(), true);
    }

    private function insert(array $attributes): void
    {
        ActivityLog::create($attributes);
    }
}
