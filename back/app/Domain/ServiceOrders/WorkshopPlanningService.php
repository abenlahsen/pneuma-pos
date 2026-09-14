<?php

namespace App\Domain\ServiceOrders;

use App\Enums\ServiceOrderStatus;
use App\Models\Bay;
use App\Models\ServiceOrder;
use Carbon\CarbonInterface;

/**
 * Planning de l'atelier (`3f`).
 *
 * Le serveur ne calcule aucune position : il rend l'heure de debut et la duree,
 * et l'interface en deduit `top` et `height` par une seule fonction du temps.
 * Renvoyer des pourcentages ici figerait l'amplitude horaire cote serveur.
 */
class WorkshopPlanningService
{
    /**
     * @return array<string, mixed>
     */
    public function forDay(CarbonInterface $day): array
    {
        return [
            'date' => $day->toDateString(),
            'bays' => Bay::query()
                ->where('is_active', true)
                ->orderBy('position')
                ->with('technician:id,name')
                ->get()
                ->map(fn (Bay $bay) => [
                    'id' => $bay->id,
                    'name' => $bay->name,
                    'technician' => $bay->technician?->name,
                ])
                ->all(),
            'scheduled' => $this->scheduled($day),
            'queue' => $this->queue(),
        ];
    }

    /** Les ordres places dans une baie ce jour-la. */
    private function scheduled(CarbonInterface $day): array
    {
        return ServiceOrder::query()
            ->with(['clientRecord:id,name'])
            ->whereNotNull('bay_id')
            ->whereNotNull('scheduled_at')
            ->whereDate('scheduled_at', $day)
            ->whereNot('status', ServiceOrderStatus::ANNULE->value)
            ->orderBy('scheduled_at')
            ->get()
            ->map(fn (ServiceOrder $o) => $this->card($o))
            ->all();
    }

    /**
     * File d'attente : ce qui est a faire mais pas encore place. C'est ce qu'on
     * fait glisser dans une baie.
     */
    private function queue(): array
    {
        return ServiceOrder::query()
            ->with(['clientRecord:id,name'])
            ->whereNull('scheduled_at')
            ->where('status', ServiceOrderStatus::EN_COURS->value)
            ->orderBy('date')
            ->limit(20)
            ->get()
            ->map(fn (ServiceOrder $o) => $this->card($o))
            ->all();
    }

    private function card(ServiceOrder $order): array
    {
        return [
            'id' => $order->id,
            'client' => $order->clientRecord?->name,
            'vehicle' => $order->vehicle,
            'status' => $order->status,
            'payment_status' => $order->payment_status,
            'amount' => round((float) $order->net_amount, 2),
            'bay_id' => $order->bay_id,
            // ISO local : l'interface n'a qu'a lire les heures et minutes.
            'scheduled_at' => $order->scheduled_at?->format('Y-m-d H:i'),
            'duration_minutes' => $order->duration_minutes,
        ];
    }

    /**
     * Place un ordre dans une baie a une heure donnee — c'est ce que fait le
     * glisser-deposer. `bay` nul le renvoie dans la file d'attente.
     */
    public function schedule(ServiceOrder $order, ?int $bayId, ?string $startsAt, ?int $duration): ServiceOrder
    {
        $order->forceFill([
            'bay_id' => $bayId,
            'scheduled_at' => $bayId === null ? null : $startsAt,
            'duration_minutes' => $bayId === null ? null : ($duration ?: 60),
        ])->save();

        return $order->fresh();
    }
}
