<?php

namespace App\Domain\Dashboard;

use App\Enums\ServiceOrderStatus;
use App\Models\CompanySetting;
use App\Models\Product;
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

    /** En dessous, la moyenne agence laisse deduire le chiffre d'un collegue. */
    private const MIN_COMMERCIALS_FOR_AVERAGE = 3;

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

        // `view stock` au singulier : c'est le nom de la permission du depot.
        if ($user->can('view stock')) {
            $queues['low_stock'] = $this->lowStock();
        }

        if ($user->can('view sales')) {
            $queues['figures'] = $this->figures($user);
        }

        return $queues;
    }

    /**
     * Produits sous seuil. La seule file sans proprietaire : un article qui
     * manque ne manque a personne en particulier, c'est une information
     * d'agence et le premier qui la voit commande. D'ou la portee `shared`,
     * qui n'est pas « tout voir » mais « rien a filtrer ».
     *
     * Deux niveaux de seuil : celui de l'article, sinon le defaut d'agence.
     * Quand aucun des deux n'est pose, l'article n'est pas surveille — mieux
     * vaut une file vide qu'une file qui remonte tout le catalogue.
     *
     * @return array<string, mixed>
     */
    private function lowStock(): array
    {
        $default = (int) CompanySetting::query()->value('default_alert_threshold');

        $query = Product::query()
            ->with('tyre')
            ->whereIn('type', ['tyre', 'part'])
            ->withSum('stocks as stock_quantity', 'quantity')
            ->havingRaw('COALESCE(products.alert_threshold, ?) > 0', [$default])
            ->havingRaw('COALESCE(stock_quantity, 0) <= COALESCE(products.alert_threshold, ?)', [$default]);

        $total = (clone $query)->get()->count();

        $rows = $query
            ->orderByRaw('COALESCE(stock_quantity, 0) ASC')
            ->limit(self::LIMIT)
            ->get()
            ->map(function (Product $product) use ($default) {
                // De quoi pre-remplir l'achat sans second aller-retour.
                $lot = $product->stocks()->orderByDesc('quantity')->first();
                $last = $this->lastPurchaseOf($product->id);

                return [
                    'product_id' => $product->id,
                    'reference' => $product->reference,
                    'dimension' => $this->dimensionOf($product),
                    'stock' => (int) ($product->stock_quantity ?? 0),
                    'threshold' => (int) ($product->alert_threshold ?? $default),
                    'stock_id' => $lot?->id,
                    'unit_price' => round((float) ($last->unit_price ?? $lot?->purchase_price ?? 0), 2),
                    'supplier_id' => $last->supplier_id ?? null,
                ];
            })
            ->values();

        return [
            'scope' => 'shared',
            'count' => $total,
            // Une file de stock compte des articles, elle n'a pas de montant.
            'total' => null,
            'rows' => $rows,
        ];
    }

    /**
     * Dernier achat non annule de l'article : il donne le fournisseur habituel
     * et le dernier prix paye. Aucune relation produit→fournisseur n'existe,
     * c'est le seul chemin.
     */
    private function lastPurchaseOf(int $productId): ?object
    {
        return DB::table('purchase_items')
            ->join('purchases', 'purchases.id', '=', 'purchase_items.purchase_id')
            ->where('purchase_items.product_id', $productId)
            ->whereNot('purchases.status', 'ANNULE')
            ->orderByDesc('purchases.date')
            ->orderByDesc('purchases.id')
            ->select('purchase_items.unit_price', 'purchases.supplier_id')
            ->first();
    }

    private function dimensionOf(Product $product): ?string
    {
        $tyre = $product->tyre;

        return $tyre?->tire_width
            ? $tyre->tire_width.'/'.$tyre->tire_height.'R'.$tyre->tire_diameter
            : null;
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
            ->selectRaw('COUNT(*) AS sales, COALESCE(SUM(total_sale), 0) AS revenue, COALESCE(SUM(margin), 0) AS margin')
            ->first();

        $month = (clone $base())->whereBetween('date', [today()->startOfMonth(), today()->endOfMonth()])
            ->selectRaw('COALESCE(SUM(total_sale), 0) AS revenue, COALESCE(SUM(margin), 0) AS margin')
            ->first();

        return [
            'scope' => $all ? 'all' : 'own',
            'today' => [
                'sales' => (int) $today->sales,
                'revenue' => round((float) $today->revenue, 2),
                'margin' => round((float) $today->margin, 2),
                'open_orders' => $this->openOrders($user, $all),
            ],
            'month' => [
                'revenue' => round((float) $month->revenue, 2),
                'margin' => round((float) $month->margin, 2),
                // Le commercial se situe sans voir personne ; le gerant a deja
                // le nominatif, la moyenne ne lui apprendrait rien.
                'agency_average' => $all ? null : $this->agencyAverage(),
                // L'objectif est personnel : un gerant n'en a pas, la barre ne
                // le concerne pas.
                'target' => $all ? null : $this->targetOf($user),
            ],
            // Le classement nominatif n'existe que pour le gerant : un
            // commercial ne classe pas ses collegues.
            'ranking' => $all ? $this->ranking() : [],
            'trend' => $all ? $this->trend() : [],
        ];
    }

    /** Ordres de service encore ouverts, sous la meme portee que le reste. */
    private function openOrders(User $user, bool $all): int
    {
        return ServiceOrder::query()
            ->where('status', 'EN COURS')
            ->when(! $all, fn (Builder $q) => $q->where('commercial_id', $user->id))
            ->count();
    }

    /** Objectif mensuel de CA, quand il a ete fixe. */
    private function targetOf(User $user): ?float
    {
        return $user->monthly_target === null ? null : round((float) $user->monthly_target, 2);
    }

    /**
     * Moyenne du mois par commercial. Elle repond a « est-ce que je suis
     * au-dessus ou en dessous ? » sans nommer personne.
     *
     * En dessous de trois commerciaux actifs elle n'est plus une moyenne mais
     * une soustraction : a deux, moyenne + ses propres chiffres donne le
     * chiffre exact du collegue. On la supprime plutot que de la publier.
     */
    private function agencyAverage(): ?float
    {
        $row = DB::table('sales')
            ->whereNot('status', 'ANNULE')
            ->whereNotNull('commercial_id')
            ->whereBetween('date', [today()->startOfMonth(), today()->endOfMonth()])
            ->selectRaw('COALESCE(SUM(total_sale), 0) AS revenue, COUNT(DISTINCT commercial_id) AS commercials')
            ->first();

        $commercials = (int) $row->commercials;

        if ($commercials < self::MIN_COMMERCIALS_FOR_AVERAGE) {
            return null;
        }

        return round((float) $row->revenue / $commercials, 2);
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
     * Tendance : chiffre d'affaires quotidien sur 30 jours, toujours 30 valeurs.
     *
     * Les jours sans vente sont completes a zero. C'est le point de la lecture
     * en barres : un jour creux doit se voir. Une courbe lissee reliait le
     * dernier jour vendu au suivant et effacait le trou.
     *
     * @return array<int, array<string, mixed>>
     */
    private function trend(): array
    {
        $start = today()->subDays(29);

        $byDay = DB::table('sales')
            ->whereNot('status', 'ANNULE')
            ->where('date', '>=', $start)
            ->groupBy('date')
            ->selectRaw('date, COALESCE(SUM(total_sale), 0) AS revenue')
            ->pluck('revenue', 'date');

        $days = [];

        for ($day = $start->copy(); $day->lte(today()); $day->addDay()) {
            $key = $day->toDateString();

            $days[] = [
                'date' => $key,
                'revenue' => round((float) ($byDay[$key] ?? 0), 2),
            ];
        }

        return $days;
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
        // Le montant suit la meme portee que les lignes : un total d'agence
        // affiche a un commercial trahirait ce que les lignes lui cachent.
        $amount = (clone $query)->sum('total_sale');

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
            'total' => round((float) $amount, 2),
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
            // `TERMINE` sans accent : c'est la valeur de `ServiceOrderStatus`,
            // pas celle annoncee par le CLAUDE.md du depot, qui est perimee.
            ->where('status', ServiceOrderStatus::TERMINE->value)
            ->whereNot('payment_status', 'PAYE');

        $this->scope($query, $user, $all);

        $total = (clone $query)->count();
        $amount = (clone $query)->sum('net_amount');

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
            'total' => round((float) $amount, 2),
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
