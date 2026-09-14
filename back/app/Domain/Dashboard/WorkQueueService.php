<?php

namespace App\Domain\Dashboard;

use App\Models\Sale;
use App\Models\ServiceOrder;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

/**
 * Files de travail de l'accueil (`5a`/`5b` du handoff).
 *
 * LA regle de ce service : la portee est appliquee ICI, dans la requete.
 * Sans la permission `.all` correspondante, la requete est filtree sur
 * `commercial_id`. Jamais de filtrage cote interface : les lignes d'un
 * collegue ne doivent pas transiter sur le reseau, une console ouverte
 * suffirait a les lire.
 */
class WorkQueueService
{
    /** Nombre de lignes remontees par file : c'est une file de travail, pas un export. */
    private const LIMIT = 12;

    /**
     * @return array<string, mixed>
     */
    public function forUser(User $user): array
    {
        $queues = [];

        if ($user->can('view sales')) {
            $queues['unpaid'] = $this->unpaidSales($user);
        }

        if ($user->can('view service-orders')) {
            $queues['to_invoice'] = $this->ordersToInvoice($user);
        }

        return $queues;
    }

    /**
     * Impayes a relancer. Portee : ses clients, sauf permission `view unpaid.all`.
     *
     * @return array<string, mixed>
     */
    private function unpaidSales(User $user): array
    {
        $all = $user->can('view unpaid.all');

        $query = Sale::query()
            ->with(['linkedClient:id,name,phone', 'commercial:id,name'])
            ->whereNot('status', 'ANNULE')
            ->whereIn('payment_status', ['NON PAYE', 'PARTIEL']);

        $this->scope($query, $user, $all);

        $total = (clone $query)->count();

        $rows = $query
            ->orderBy('date')
            ->limit(self::LIMIT)
            ->get()
            ->map(fn (Sale $sale) => [
                'id' => $sale->id,
                'date' => $sale->date,
                'client' => $sale->linkedClient?->name,
                'phone' => $sale->linkedClient?->phone,
                'commercial' => $sale->commercial?->name,
                'amount' => (float) $sale->total_sale,
                'payment_status' => $sale->payment_status,
            ])
            ->values();

        return [
            'scope' => $all ? 'all' : 'own',
            'count' => $total,
            'rows' => $rows,
        ];
    }

    /**
     * Ordres termines restant a facturer. Portee : ses ordres, sauf
     * permission `view service-orders.all`.
     *
     * @return array<string, mixed>
     */
    private function ordersToInvoice(User $user): array
    {
        $all = $user->can('view service-orders.all');

        $query = ServiceOrder::query()
            ->with(['commercial:id,name'])
            ->where('status', 'TERMINÉE')
            ->whereNot('payment_status', 'PAYE');

        $this->scope($query, $user, $all);

        $total = (clone $query)->count();

        $rows = $query
            ->orderBy('date')
            ->limit(self::LIMIT)
            ->get()
            ->map(fn (ServiceOrder $order) => [
                'id' => $order->id,
                'date' => $order->date,
                'vehicle' => $order->vehicle,
                'commercial' => $order->commercial?->name,
                'amount' => (float) $order->net_amount,
                'payment_status' => $order->payment_status,
            ])
            ->values();

        return [
            'scope' => $all ? 'all' : 'own',
            'count' => $total,
            'rows' => $rows,
        ];
    }

    /**
     * Defaut sur : en l'absence de la permission `.all`, on ne voit que ses
     * propres lignes. Une ligne sans commercial rattache reste invisible pour
     * un commercial — mieux vaut une file trop courte qu'une fuite.
     */
    private function scope(Builder $query, User $user, bool $all): void
    {
        if (! $all) {
            $query->where('commercial_id', $user->id);
        }
    }
}
