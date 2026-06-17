<?php

namespace App\Services;

use App\Models\ActivityLog;
use App\Models\Purchase;
use App\Models\Sale;
use App\Models\ServiceOrder;
use App\Models\User;

class ActivityLogService
{
    // -------------------------------------------------------------------------
    // Snapshots
    // -------------------------------------------------------------------------

    public function buildSaleSnapshot(Sale $sale): array
    {
        $snapshot = [
            'date'           => $sale->date ? (string) $sale->date : null,
            'status'         => $sale->status,
            'payment_status' => $sale->payment_status,
            'total_sale'     => (float) $sale->total_sale,
            'total_purchase' => (float) $sale->total_purchase,
            'total_quantity' => (int) $sale->total_quantity,
            'margin'         => (float) $sale->margin,
            'payment_method' => $sale->payment_method,
            'with_invoice'   => (bool) $sale->with_invoice,
            'client'         => $sale->linkedClient?->name,
            'commercial'     => $sale->commercial?->name,
            'carrier'        => $sale->linkedCarrier?->name,
            'partner'        => $sale->linkedPartner?->name,
        ];

        return array_filter($snapshot, fn ($v) => $v !== null && $v !== '');
    }

    public function buildPurchaseSnapshot(Purchase $purchase): array
    {
        $snapshot = [
            'date'           => $purchase->date ? (string) $purchase->date : null,
            'status'         => $purchase->status,
            'payment_status' => $purchase->payment_status,
            'net_amount'     => (float) $purchase->net_amount,
            'total_quantity' => (int) $purchase->total_quantity,
            'payment_method' => $purchase->payment_method,
            'with_invoice'   => (bool) $purchase->with_invoice,
            'discount'       => (float) $purchase->discount,
            'supplier'       => $purchase->supplier?->name,
            'commercial'     => $purchase->commercial?->name,
        ];

        return array_filter($snapshot, fn ($v) => $v !== null && $v !== '');
    }

    public function buildServiceOrderSnapshot(ServiceOrder $order): array
    {
        $snapshot = [
            'date'           => $order->date ? (string) $order->date : null,
            'status'         => $order->status,
            'payment_status' => $order->payment_status,
            'net_amount'     => (float) $order->net_amount,
            'total_amount'   => (float) $order->total_amount,
            'discount'       => (float) $order->discount,
            'vehicle'        => $order->vehicle,
            'mileage'        => $order->mileage ? (int) $order->mileage : null,
            'notes'          => $order->notes,
            'client'         => $order->clientRecord?->name,
            'commercial'     => $order->commercial?->name,
        ];

        return array_filter($snapshot, fn ($v) => $v !== null && $v !== '');
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
            . ($clientName ? " — Client : {$clientName}" : '');

        $this->insert([
            'action'       => ActivityLog::ACTION_CREATE,
            'entity_type'  => ActivityLog::ENTITY_VENTE,
            'entity_id'    => $sale->id,
            'entity_label' => "Vente #{$sale->id}",
            'description'  => $desc,
            'properties'   => ['before' => null, 'after' => $snapshot],
            'user_id'      => $userId,
            'user_name'    => $userName,
        ]);
    }

    public function logSaleUpdated(Sale $sale, array $before, array $after, ?int $userId, ?string $userName): void
    {
        $desc = "Vente #{$sale->id} modifiée";
        $desc .= $this->buildUpdateSuffix($before, $after);

        $this->insert([
            'action'       => ActivityLog::ACTION_UPDATE,
            'entity_type'  => ActivityLog::ENTITY_VENTE,
            'entity_id'    => $sale->id,
            'entity_label' => "Vente #{$sale->id}",
            'description'  => $desc,
            'properties'   => ['before' => $before, 'after' => $after],
            'user_id'      => $userId,
            'user_name'    => $userName,
        ]);
    }

    public function logSaleDeleted(array $before, ?int $userId, ?string $userName): void
    {
        $total = number_format((float) ($before['total_sale'] ?? 0), 2, '.', ' ');
        $status = $before['payment_status'] ?? '';
        $id = $before['id'];
        $desc = "Vente #{$id} supprimée — CA : {$total} MAD ({$status})";

        $this->insert([
            'action'       => ActivityLog::ACTION_DELETE,
            'entity_type'  => ActivityLog::ENTITY_VENTE,
            'entity_id'    => $id,
            'entity_label' => "Vente #{$id}",
            'description'  => $desc,
            'properties'   => ['before' => $before, 'after' => null],
            'user_id'      => $userId,
            'user_name'    => $userName,
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
            . ($supplierName ? " — Fournisseur : {$supplierName}" : '');

        $this->insert([
            'action'       => ActivityLog::ACTION_CREATE,
            'entity_type'  => ActivityLog::ENTITY_ACHAT,
            'entity_id'    => $purchase->id,
            'entity_label' => "Achat #{$purchase->id}",
            'description'  => $desc,
            'properties'   => ['before' => null, 'after' => $snapshot],
            'user_id'      => $userId,
            'user_name'    => $userName,
        ]);
    }

    public function logPurchaseUpdated(Purchase $purchase, array $before, array $after, ?int $userId, ?string $userName): void
    {
        $desc = "Achat #{$purchase->id} modifié";
        $desc .= $this->buildUpdateSuffix($before, $after);

        $this->insert([
            'action'       => ActivityLog::ACTION_UPDATE,
            'entity_type'  => ActivityLog::ENTITY_ACHAT,
            'entity_id'    => $purchase->id,
            'entity_label' => "Achat #{$purchase->id}",
            'description'  => $desc,
            'properties'   => ['before' => $before, 'after' => $after],
            'user_id'      => $userId,
            'user_name'    => $userName,
        ]);
    }

    public function logPurchaseDeleted(array $before, ?int $userId, ?string $userName): void
    {
        $total = number_format((float) ($before['net_amount'] ?? 0), 2, '.', ' ');
        $status = $before['payment_status'] ?? '';
        $id = $before['id'];
        $desc = "Achat #{$id} supprimé — Montant : {$total} MAD ({$status})";

        $this->insert([
            'action'       => ActivityLog::ACTION_DELETE,
            'entity_type'  => ActivityLog::ENTITY_ACHAT,
            'entity_id'    => $id,
            'entity_label' => "Achat #{$id}",
            'description'  => $desc,
            'properties'   => ['before' => $before, 'after' => null],
            'user_id'      => $userId,
            'user_name'    => $userName,
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
            . ($clientName ? " — {$clientName}" : '')
            . ($vehicle ? " — {$vehicle}" : '');

        $this->insert([
            'action'       => ActivityLog::ACTION_CREATE,
            'entity_type'  => ActivityLog::ENTITY_SERVICE_ORDER,
            'entity_id'    => $order->id,
            'entity_label' => "Ordre de service #{$order->id}",
            'description'  => $desc,
            'properties'   => ['before' => null, 'after' => $snapshot],
            'user_id'      => $userId,
            'user_name'    => $userName,
        ]);
    }

    public function logServiceOrderUpdated(ServiceOrder $order, array $before, array $after, ?int $userId, ?string $userName): void
    {
        $desc = "Ordre de service #{$order->id} modifié";
        $desc .= $this->buildUpdateSuffix($before, $after);

        $this->insert([
            'action'       => ActivityLog::ACTION_UPDATE,
            'entity_type'  => ActivityLog::ENTITY_SERVICE_ORDER,
            'entity_id'    => $order->id,
            'entity_label' => "Ordre de service #{$order->id}",
            'description'  => $desc,
            'properties'   => ['before' => $before, 'after' => $after],
            'user_id'      => $userId,
            'user_name'    => $userName,
        ]);
    }

    public function logServiceOrderDeleted(array $before, ?int $userId, ?string $userName): void
    {
        $total = number_format((float) ($before['net_amount'] ?? 0), 2, '.', ' ');
        $status = $before['payment_status'] ?? '';
        $id = $before['id'];
        $desc = "Ordre de service #{$id} supprimé — {$total} MAD ({$status})";

        $this->insert([
            'action'       => ActivityLog::ACTION_DELETE,
            'entity_type'  => ActivityLog::ENTITY_SERVICE_ORDER,
            'entity_id'    => $id,
            'entity_label' => "Ordre de service #{$id}",
            'description'  => $desc,
            'properties'   => ['before' => $before, 'after' => null],
            'user_id'      => $userId,
            'user_name'    => $userName,
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
            'action'       => ActivityLog::ACTION_PAYMENT_ADD,
            'entity_type'  => $entityType,
            'entity_id'    => $entityId,
            'entity_label' => $entityLabel,
            'description'  => $desc,
            'properties'   => [
                'amount'    => $amount,
                'method'    => $method,
                'reference' => $reference,
            ],
            'user_id'   => $userId,
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
            'action'       => ActivityLog::ACTION_PAYMENT_DELETE,
            'entity_type'  => $entityType,
            'entity_id'    => $entityId,
            'entity_label' => $entityLabel,
            'description'  => $desc,
            'properties'   => [
                'amount' => $amount,
                'method' => $method,
            ],
            'user_id'   => $userId,
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
            return " — Statut : " . ($before['status'] ?? '?') . " → {$after['status']}";
        }

        if (isset($after['payment_status']) && ($before['payment_status'] ?? null) !== $after['payment_status']) {
            return " — Paiement : " . ($before['payment_status'] ?? '?') . " → {$after['payment_status']}";
        }

        $totalKey = isset($after['total_sale']) ? 'total_sale' : (isset($after['net_amount']) ? 'net_amount' : null);
        if ($totalKey && isset($before[$totalKey]) && abs((float) $before[$totalKey] - (float) $after[$totalKey]) > 0.01) {
            $old = number_format((float) $before[$totalKey], 2, '.', ' ');
            $new = number_format((float) $after[$totalKey], 2, '.', ' ');
            return " — Montant : {$old} → {$new} MAD";
        }

        return '';
    }

    private function insert(array $attributes): void
    {
        ActivityLog::create($attributes);
    }
}
