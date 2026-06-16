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
    // Ventes
    // -------------------------------------------------------------------------

    public function logSaleCreated(Sale $sale, ?int $userId, ?string $userName): void
    {
        $clientName = $sale->linkedClient?->name ?? null;
        $qty = (int) $sale->total_quantity;
        $total = number_format((float) $sale->total_sale, 2, '.', ' ');
        $desc = "Vente #{$sale->id} créée — {$qty} article(s), CA : {$total} MAD"
            . ($clientName ? " — Client : {$clientName}" : '');

        $this->insert([
            'action'       => ActivityLog::ACTION_CREATE,
            'entity_type'  => ActivityLog::ENTITY_VENTE,
            'entity_id'    => $sale->id,
            'entity_label' => "Vente #{$sale->id}",
            'description'  => $desc,
            'properties'   => [
                'total_sale'      => $sale->total_sale,
                'total_quantity'  => $sale->total_quantity,
                'payment_status'  => $sale->payment_status,
                'status'          => $sale->status,
                'client'          => $clientName,
            ],
            'user_id'   => $userId,
            'user_name' => $userName,
        ]);
    }

    public function logSaleUpdated(Sale $sale, array $oldState, array $newState, ?int $userId, ?string $userName): void
    {
        $diff = $this->buildDiff($oldState, $newState);
        $desc = "Vente #{$sale->id} modifiée";

        if (isset($diff['status'])) {
            $desc .= " — Statut : {$diff['status']['from']} → {$diff['status']['to']}";
        } elseif (isset($diff['payment_status'])) {
            $desc .= " — Paiement : {$diff['payment_status']['from']} → {$diff['payment_status']['to']}";
        }

        $this->insert([
            'action'       => ActivityLog::ACTION_UPDATE,
            'entity_type'  => ActivityLog::ENTITY_VENTE,
            'entity_id'    => $sale->id,
            'entity_label' => "Vente #{$sale->id}",
            'description'  => $desc,
            'properties'   => $diff ?: null,
            'user_id'   => $userId,
            'user_name' => $userName,
        ]);
    }

    public function logSaleDeleted(array $snapshot, ?int $userId, ?string $userName): void
    {
        $total = number_format((float) ($snapshot['total_sale'] ?? 0), 2, '.', ' ');
        $status = $snapshot['payment_status'] ?? '';
        $desc = "Vente #{$snapshot['id']} supprimée — CA : {$total} MAD ({$status})";

        $this->insert([
            'action'       => ActivityLog::ACTION_DELETE,
            'entity_type'  => ActivityLog::ENTITY_VENTE,
            'entity_id'    => $snapshot['id'],
            'entity_label' => "Vente #{$snapshot['id']}",
            'description'  => $desc,
            'properties'   => $snapshot,
            'user_id'   => $userId,
            'user_name' => $userName,
        ]);
    }

    // -------------------------------------------------------------------------
    // Achats
    // -------------------------------------------------------------------------

    public function logPurchaseCreated(Purchase $purchase, ?int $userId, ?string $userName): void
    {
        $supplierName = $purchase->supplier?->name ?? null;
        $qty = (int) $purchase->total_quantity;
        $total = number_format((float) $purchase->net_amount, 2, '.', ' ');
        $desc = "Achat #{$purchase->id} créé — {$qty} article(s), Montant : {$total} MAD"
            . ($supplierName ? " — Fournisseur : {$supplierName}" : '');

        $this->insert([
            'action'       => ActivityLog::ACTION_CREATE,
            'entity_type'  => ActivityLog::ENTITY_ACHAT,
            'entity_id'    => $purchase->id,
            'entity_label' => "Achat #{$purchase->id}",
            'description'  => $desc,
            'properties'   => [
                'net_amount'      => $purchase->net_amount,
                'total_quantity'  => $purchase->total_quantity,
                'payment_status'  => $purchase->payment_status,
                'status'          => $purchase->status,
                'supplier'        => $supplierName,
            ],
            'user_id'   => $userId,
            'user_name' => $userName,
        ]);
    }

    public function logPurchaseUpdated(Purchase $purchase, array $oldState, array $newState, ?int $userId, ?string $userName): void
    {
        $diff = $this->buildDiff($oldState, $newState);
        $desc = "Achat #{$purchase->id} modifié";

        if (isset($diff['status'])) {
            $desc .= " — Statut : {$diff['status']['from']} → {$diff['status']['to']}";
        } elseif (isset($diff['payment_status'])) {
            $desc .= " — Paiement : {$diff['payment_status']['from']} → {$diff['payment_status']['to']}";
        }

        $this->insert([
            'action'       => ActivityLog::ACTION_UPDATE,
            'entity_type'  => ActivityLog::ENTITY_ACHAT,
            'entity_id'    => $purchase->id,
            'entity_label' => "Achat #{$purchase->id}",
            'description'  => $desc,
            'properties'   => $diff ?: null,
            'user_id'   => $userId,
            'user_name' => $userName,
        ]);
    }

    public function logPurchaseDeleted(array $snapshot, ?int $userId, ?string $userName): void
    {
        $total = number_format((float) ($snapshot['net_amount'] ?? 0), 2, '.', ' ');
        $status = $snapshot['payment_status'] ?? '';
        $desc = "Achat #{$snapshot['id']} supprimé — Montant : {$total} MAD ({$status})";

        $this->insert([
            'action'       => ActivityLog::ACTION_DELETE,
            'entity_type'  => ActivityLog::ENTITY_ACHAT,
            'entity_id'    => $snapshot['id'],
            'entity_label' => "Achat #{$snapshot['id']}",
            'description'  => $desc,
            'properties'   => $snapshot,
            'user_id'   => $userId,
            'user_name' => $userName,
        ]);
    }

    // -------------------------------------------------------------------------
    // Service Auto
    // -------------------------------------------------------------------------

    public function logServiceOrderCreated(ServiceOrder $order, ?int $userId, ?string $userName): void
    {
        $clientName = $order->clientRecord?->name ?? $order->client ?? null;
        $vehicle = $order->vehicle ?? '';
        $total = number_format((float) $order->net_amount, 2, '.', ' ');
        $desc = "Ordre de service #{$order->id} créé — {$total} MAD"
            . ($clientName ? " — {$clientName}" : '')
            . ($vehicle ? " — {$vehicle}" : '');

        $this->insert([
            'action'       => ActivityLog::ACTION_CREATE,
            'entity_type'  => ActivityLog::ENTITY_SERVICE_ORDER,
            'entity_id'    => $order->id,
            'entity_label' => "Ordre de service #{$order->id}",
            'description'  => $desc,
            'properties'   => [
                'net_amount'     => $order->net_amount,
                'payment_status' => $order->payment_status,
                'status'         => $order->status,
                'client'         => $clientName,
                'vehicle'        => $vehicle,
            ],
            'user_id'   => $userId,
            'user_name' => $userName,
        ]);
    }

    public function logServiceOrderUpdated(ServiceOrder $order, array $oldState, array $newState, ?int $userId, ?string $userName): void
    {
        $diff = $this->buildDiff($oldState, $newState);
        $desc = "Ordre de service #{$order->id} modifié";

        if (isset($diff['status'])) {
            $desc .= " — Statut : {$diff['status']['from']} → {$diff['status']['to']}";
        } elseif (isset($diff['payment_status'])) {
            $desc .= " — Paiement : {$diff['payment_status']['from']} → {$diff['payment_status']['to']}";
        }

        $this->insert([
            'action'       => ActivityLog::ACTION_UPDATE,
            'entity_type'  => ActivityLog::ENTITY_SERVICE_ORDER,
            'entity_id'    => $order->id,
            'entity_label' => "Ordre de service #{$order->id}",
            'description'  => $desc,
            'properties'   => $diff ?: null,
            'user_id'   => $userId,
            'user_name' => $userName,
        ]);
    }

    public function logServiceOrderDeleted(array $snapshot, ?int $userId, ?string $userName): void
    {
        $total = number_format((float) ($snapshot['net_amount'] ?? 0), 2, '.', ' ');
        $status = $snapshot['payment_status'] ?? '';
        $desc = "Ordre de service #{$snapshot['id']} supprimé — {$total} MAD ({$status})";

        $this->insert([
            'action'       => ActivityLog::ACTION_DELETE,
            'entity_type'  => ActivityLog::ENTITY_SERVICE_ORDER,
            'entity_id'    => $snapshot['id'],
            'entity_label' => "Ordre de service #{$snapshot['id']}",
            'description'  => $desc,
            'properties'   => $snapshot,
            'user_id'   => $userId,
            'user_name' => $userName,
        ]);
    }

    // -------------------------------------------------------------------------
    // Paiements (générique)
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

    private function buildDiff(array $oldState, array $newState): array
    {
        $diff = [];

        foreach ($newState as $key => $newValue) {
            $oldValue = $oldState[$key] ?? null;

            if (is_float($newValue) || is_float($oldValue)) {
                if (abs((float) $oldValue - (float) $newValue) > 0.01) {
                    $diff[$key] = ['from' => $oldValue, 'to' => $newValue];
                }
            } elseif ($oldValue !== $newValue) {
                $diff[$key] = ['from' => $oldValue, 'to' => $newValue];
            }
        }

        return $diff;
    }

    private function insert(array $attributes): void
    {
        ActivityLog::create($attributes);
    }
}
