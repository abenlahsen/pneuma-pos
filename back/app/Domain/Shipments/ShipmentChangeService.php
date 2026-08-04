<?php

namespace App\Domain\Shipments;

use App\Enums\ShipmentChangeStatus;
use App\Models\Sale;
use App\Models\ShipmentChangeRequest;
use App\Services\ActivityLogService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ShipmentChangeService
{
    public function __construct(
        private ActivityLogService $activityLog,
    ) {}

    public function list(array $filters): array
    {
        $query = ShipmentChangeRequest::query()->with(['sale', 'carrier']);

        $this->applyFilters($query, $filters);

        $query->orderByDesc('date')->orderByDesc('id');

        $perPage = (int) ($filters['per_page'] ?? 20);
        $paginator = $query->paginate($perPage);

        return [
            'data' => $paginator->getCollection(),
            'total' => $paginator->total(),
            'current_page' => $paginator->currentPage(),
            'last_page' => $paginator->lastPage(),
            'per_page' => $paginator->perPage(),
        ];
    }

    public function listForSale(Sale $sale): Collection
    {
        return $sale->shipmentChangeRequests()
            ->with(['sale', 'carrier', 'items'])
            ->orderByDesc('date')
            ->orderByDesc('id')
            ->get();
    }

    public function create(Sale $sale, array $validated, ?int $userId): ShipmentChangeRequest
    {
        return DB::transaction(function () use ($sale, $validated, $userId) {
            $items = $validated['items'] ?? [];

            $request = ShipmentChangeRequest::create([
                'sale_id' => $sale->id,
                'carrier_id' => $validated['carrier_id'] ?? $sale->carrier_id,
                'shipment_number' => $validated['shipment_number'] ?? $sale->tracking_number,
                'date' => $validated['date'],
                'status' => $validated['status'] ?? ShipmentChangeStatus::BROUILLON->value,
                'reason' => $validated['reason'] ?? null,
                'created_by' => $userId,
            ]);

            $this->syncItems($request, $items);

            $loaded = $request->fresh()->load(['sale', 'carrier', 'items']);

            $snapshot = $this->activityLog->buildShipmentChangeSnapshot($loaded);
            $this->activityLog->logShipmentChangeCreated($loaded, $snapshot, $userId, ActivityLogService::resolveUserName($userId));

            return $loaded;
        });
    }

    public function update(ShipmentChangeRequest $request, array $validated, ?int $userId): ShipmentChangeRequest
    {
        $this->guardClosed($request);

        $request->loadMissing(['sale', 'carrier']);
        $beforeSnapshot = $this->activityLog->buildShipmentChangeSnapshot($request);

        return DB::transaction(function () use ($request, $validated, $userId, $beforeSnapshot) {
            $items = $validated['items'] ?? null;
            unset($validated['items']);

            $request->update(array_merge($validated, [
                'updated_by' => $userId,
            ]));

            if ($items !== null) {
                $this->syncItems($request, $items);
            }

            $loaded = $request->fresh()->load(['sale', 'carrier', 'items']);

            $afterSnapshot = $this->activityLog->buildShipmentChangeSnapshot($loaded);
            $this->activityLog->logShipmentChangeUpdated($loaded, $beforeSnapshot, $afterSnapshot, $userId, ActivityLogService::resolveUserName($userId));

            return $loaded;
        });
    }

    public function updateStatus(ShipmentChangeRequest $request, array $validated, ?int $userId): ShipmentChangeRequest
    {
        $this->guardClosed($request);

        $request->loadMissing(['sale', 'carrier']);
        $beforeSnapshot = $this->activityLog->buildShipmentChangeSnapshot($request);

        return DB::transaction(function () use ($request, $validated, $userId, $beforeSnapshot) {
            $newStatus = $validated['status'];

            $attributes = [
                'status' => $newStatus,
                'carrier_response' => $validated['carrier_response'] ?? $request->carrier_response,
                'updated_by' => $userId,
            ];

            if ($newStatus === ShipmentChangeStatus::ENVOYEE->value && $request->sent_at === null) {
                $attributes['sent_at'] = now();
            }

            $request->update($attributes);

            $loaded = $request->fresh()->load(['sale', 'carrier', 'items']);

            $afterSnapshot = $this->activityLog->buildShipmentChangeSnapshot($loaded);
            $this->activityLog->logShipmentChangeUpdated($loaded, $beforeSnapshot, $afterSnapshot, $userId, ActivityLogService::resolveUserName($userId));

            return $loaded;
        });
    }

    public function delete(ShipmentChangeRequest $request, ?int $userId = null): void
    {
        $this->guardClosed($request);

        $request->loadMissing(['sale', 'carrier']);
        $beforeSnapshot = array_merge(['id' => $request->id], $this->activityLog->buildShipmentChangeSnapshot($request));

        DB::transaction(function () use ($request) {
            $request->items()->delete();
            $request->delete();
        });

        $this->activityLog->logShipmentChangeDeleted($beforeSnapshot, $userId, ActivityLogService::resolveUserName($userId));
    }

    private function syncItems(ShipmentChangeRequest $request, array $items): void
    {
        $request->items()->delete();

        foreach ($items as $i => $itemData) {
            $request->items()->create([
                'field' => $itemData['field'],
                'custom_label' => $itemData['custom_label'] ?? null,
                'old_value' => $itemData['old_value'] ?? '',
                'new_value' => $itemData['new_value'],
                'sort_order' => $itemData['sort_order'] ?? $i,
            ]);
        }
    }

    private function guardClosed(ShipmentChangeRequest $request): void
    {
        if (in_array($request->status, [ShipmentChangeStatus::ACCEPTEE->value, ShipmentChangeStatus::REFUSEE->value], true)) {
            throw ValidationException::withMessages([
                'status' => ["Cette demande est déjà close ({$request->status}) et ne peut plus être modifiée."],
            ]);
        }
    }

    private function applyFilters(Builder $query, array $filters): void
    {
        if (! empty($filters['sale_id'])) {
            $query->where('sale_id', (int) $filters['sale_id']);
        }

        if (! empty($filters['carrier_id'])) {
            $query->where('carrier_id', (int) $filters['carrier_id']);
        }

        if (! empty($filters['status'])) {
            $query->where('status', (string) $filters['status']);
        }

        if (! empty($filters['date_from'])) {
            $query->whereDate('date', '>=', (string) $filters['date_from']);
        }

        if (! empty($filters['date_to'])) {
            $query->whereDate('date', '<=', (string) $filters['date_to']);
        }

        if (! empty($filters['search'])) {
            $search = trim((string) $filters['search']);
            $query->where('shipment_number', 'like', "%{$search}%");
        }
    }
}
