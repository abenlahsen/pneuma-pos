<?php

namespace App\Domain\Dashboard;

use App\Models\Sale;
use App\Models\ServiceOrder;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

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

        if ($user->can('view sales')) {
            $queues['figures'] = $this->figures($user);
        }

        return $queues;
    }

    /**
     * Colonne laterale (`5a`/`5b`) : « mes chiffres » ou ceux de l'agence.
     *
     * Meme regle de portee que les files, et pour la meme raison : un total
     * d'agence permet de deduire les chiffres d'un collegue des qu'on connait
     * les siens. Sans `view reporting.all`, tout est filtre sur commercial_id.
     *
     * @return array<string, mixed>
     */
    private function figures(User $user): array
    {
        $all = $user->can('view reporting.all');

        $base = fn () => Sale::query()->whereNot('status', 'ANNULE')
            ->when(! $all, fn (Builder $q) => $q->where('commercial_id', $user->id));

        $today = (clone $base())->whereDate('date', today())
            ->selectRaw('COUNT(*) AS sales, COALESCE(SUM(total_sale), 0) AS revenue')
            ->first();

        $month = (clone $base())->whereBetween('date', [today()->startOfMonth(), today()->endOfMonth()])
            ->selectRaw('COALESCE(SUM(total_sale), 0) AS revenue, COALESCE(SUM(margin), 0) AS margin')
            ->first();

        return [
            'scope' => $all ? 'all' : 'own',
            'today' => [
                'sales' => (int) $today->sales,
                'revenue' => round((float) $today->revenue, 2),
            ],
            'month' => [
                'revenue' => round((float) $month->revenue, 2),
                'margin' => round((float) $month->margin, 2),
            ],
            // Le classement nominatif n'existe que pour le gerant : un
            // commercial ne classe pas ses collegues.
            'ranking' => $all ? $this->ranking() : [],
            'trend' => $all ? $this->trend() : [],
        ];
    }

    /**
     * Classement par commercial, chacun avec son impaye : un CA eleve
     * accompagne d'un impaye eleve n'est pas une performance.
     *
     * @return array<int, array<string, mixed>>
     */
    private function ranking(): array
    {
        return DB::table('sales')
            ->join('users', 'users.id', '=', 'sales.commercial_id')
            ->whereNot('sales.status', 'ANNULE')
            ->whereBetween('sales.date', [today()->startOfMonth(), today()->endOfMonth()])
            ->groupBy('users.id', 'users.name')
            ->orderByDesc('revenue')
            ->selectRaw("users.id, users.name,
                COALESCE(SUM(sales.total_sale), 0) AS revenue,
                COALESCE(SUM(CASE WHEN sales.payment_status <> 'PAYÉ' THEN sales.total_sale ELSE 0 END), 0) AS unpaid")
            ->get()
            ->map(fn ($row) => [
                'id' => (int) $row->id,
                'name' => $row->name,
                'revenue' => round((float) $row->revenue, 2),
                'unpaid' => round((float) $row->unpaid, 2),
            ])
            ->all();
    }

    /**
     * Tendance : chiffre d'affaires quotidien sur 30 jours. Les jours sans
     * vente sont absents — la courbe les traite comme des creux, pas comme
     * des trous.
     *
     * @return array<int, array<string, mixed>>
     */
    private function trend(): array
    {
        return DB::table('sales')
            ->whereNot('status', 'ANNULE')
            ->where('date', '>=', today()->subDays(29))
            ->groupBy('date')
            ->orderBy('date')
            ->selectRaw('date, COALESCE(SUM(total_sale), 0) AS revenue')
            ->get()
            ->map(fn ($row) => [
                'date' => (string) $row->date,
                'revenue' => round((float) $row->revenue, 2),
            ])
            ->all();
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
