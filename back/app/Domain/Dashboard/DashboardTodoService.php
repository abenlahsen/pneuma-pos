<?php

namespace App\Domain\Dashboard;

use App\Models\Purchase;
use App\Models\Sale;
use App\Models\ServiceOrder;
use App\Models\Transaction;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Refonte 2b — Accueil : la liste « à traiter » (README, écran 2b).
 *
 * L'Accueil cesse d'être un mur de cadrans : quatre chiffres décident, le reste
 * est une liste de choses à faire, chacune avec son montant et son action. Ce
 * service assemble ces quatre familles à partir des données existantes.
 *
 * Chaque bloc n'est calculé que si l'utilisateur a le droit de voir les données
 * sous-jacentes — un commercial sans accès aux achats ne reçoit pas le bloc
 * fournisseurs plutôt que de le recevoir vide.
 */
class DashboardTodoService
{
    /** Nombre de lignes détaillées renvoyées par bloc (le compte et le total, eux, portent sur tout le bloc). */
    private const ROWS_PER_GROUP = 5;

    /**
     * Au-delà de ce nombre de jours, une dette fournisseur est signalée.
     * Le README pose la question du seuil légal exact (90 j ?) sans la trancher :
     * on se contente donc de compter les dettes anciennes, sans qualifier
     * juridiquement le retard.
     */
    private const OLD_DEBT_DAYS = 90;

    public function build(User $user): array
    {
        return [
            'unpaid_sales' => $user->can('view sales') ? $this->unpaidSales() : null,
            'unpaid_purchases' => $user->can('view purchases') ? $this->unpaidPurchases() : null,
            'to_invoice' => $user->can('view service-orders') ? $this->serviceOrdersToInvoice() : null,
            'low_stock' => $user->can('view stock') ? $this->lowStock() : null,
            'collected_today' => $user->can('view cash-flow') ? $this->collectedToday() : null,
            'sales_last_30_days' => $user->can('view sales') ? $this->salesLast30Days() : null,
        ];
    }

    /**
     * Ventes non soldées. Le « retard » est l'âge de la vente en jours : le
     * délai contractuel du client n'est pas toujours renseigné, l'âge l'est
     * toujours.
     */
    private function unpaidSales(): array
    {
        $paidSub = DB::table('sale_payment_allocations')
            ->selectRaw('sale_id, SUM(amount) as paid')
            ->groupBy('sale_id');

        $rows = DB::table('sales')
            ->leftJoinSub($paidSub, 'alloc', 'alloc.sale_id', '=', 'sales.id')
            ->leftJoin('clients', 'clients.id', '=', 'sales.client_id')
            ->leftJoin('cities', 'cities.id', '=', 'clients.city_id')
            ->leftJoin('users', 'users.id', '=', 'sales.commercial_id')
            ->where('sales.payment_status', '!=', 'PAYE')
            ->where('sales.status', '!=', 'ANNULE')
            ->selectRaw('
                sales.id,
                sales.date,
                sales.client_id,
                clients.name as client_name,
                cities.name as city,
                users.name as commercial,
                GREATEST(sales.total_sale - COALESCE(alloc.paid, 0), 0) as remaining,
                DATEDIFF(CURDATE(), sales.date) as days
            ')
            ->havingRaw('remaining > 0.004')
            ->orderByDesc('remaining')
            ->get();

        return [
            'count' => $rows->count(),
            'total' => round((float) $rows->sum('remaining'), 2),
            'rows' => $rows->take(self::ROWS_PER_GROUP)->map(fn ($r) => [
                'id' => (int) $r->id,
                'client_id' => $r->client_id !== null ? (int) $r->client_id : null,
                'client_name' => $r->client_name ?: 'Client de passage',
                'date' => $r->date,
                'city' => $r->city,
                'commercial' => $r->commercial,
                'days' => (int) $r->days,
                'amount' => round((float) $r->remaining, 2),
            ])->values()->all(),
        ];
    }

    /**
     * Achats non soldés, au reste dû effectif (retours déduits, remise
     * appliquée) — même formule que SupplierService::calcOutstanding().
     */
    private function unpaidPurchases(): array
    {
        $allocSub = DB::table('purchase_payment_allocations')
            ->selectRaw('purchase_id, SUM(amount) as paid')
            ->groupBy('purchase_id');

        $returnSub = DB::table('purchase_returns')
            ->selectRaw('purchase_id, SUM(refund_amount) as refunded')
            ->groupBy('purchase_id');

        $effectiveNet = 'purchases.net_amount - purchases.returned_amount * (1 - purchases.discount / 100)';
        $netPaid = 'COALESCE(alloc.paid, 0) - COALESCE(ret.refunded, 0)';

        $rows = DB::table('purchases')
            ->leftJoinSub($allocSub, 'alloc', 'alloc.purchase_id', '=', 'purchases.id')
            ->leftJoinSub($returnSub, 'ret', 'ret.purchase_id', '=', 'purchases.id')
            ->leftJoin('suppliers', 'suppliers.id', '=', 'purchases.supplier_id')
            ->where('purchases.payment_status', '!=', 'PAYE')
            ->where('purchases.status', '!=', 'ANNULE')
            ->selectRaw("
                purchases.id,
                purchases.date,
                purchases.supplier_id,
                purchases.with_invoice,
                COALESCE(suppliers.name, 'Sans fournisseur') as supplier_name,
                GREATEST(($effectiveNet) - ($netPaid), 0) as remaining,
                DATEDIFF(CURDATE(), purchases.date) as days
            ")
            ->havingRaw('remaining > 0.004')
            ->orderByDesc('remaining')
            ->get();

        return [
            'count' => $rows->count(),
            'total' => round((float) $rows->sum('remaining'), 2),
            'old_debt_days' => self::OLD_DEBT_DAYS,
            'old_debt_count' => $rows->where('days', '>', self::OLD_DEBT_DAYS)->count(),
            'rows' => $rows->take(self::ROWS_PER_GROUP)->map(fn ($r) => [
                'id' => (int) $r->id,
                'supplier_id' => $r->supplier_id !== null ? (int) $r->supplier_id : null,
                'supplier_name' => $r->supplier_name,
                'date' => $r->date,
                'with_invoice' => (bool) $r->with_invoice,
                'days' => (int) $r->days,
                'amount' => round((float) $r->remaining, 2),
            ])->values()->all(),
        ];
    }

    /**
     * Interventions terminées et pas encore réglées — le même seau que la
     * colonne « Terminé, à facturer » de la vue atelier.
     */
    private function serviceOrdersToInvoice(): array
    {
        $orders = ServiceOrder::query()
            ->where('status', 'TERMINE')
            ->where('payment_status', 'NON PAYE')
            ->with(['vehicle', 'clientRecord', 'commercial'])
            ->withCount('items')
            ->orderByDesc('net_amount')
            ->get();

        return [
            'count' => $orders->count(),
            'total' => round((float) $orders->sum('net_amount'), 2),
            // `vehicle` est à la fois une colonne (texte libre) et une relation
            // sur ServiceOrder : l'accesseur rend la colonne, la fiche véhicule
            // ne s'obtient que par getRelation().
            'rows' => $orders->take(self::ROWS_PER_GROUP)->map(function (ServiceOrder $order) {
                $vehicle = $order->relationLoaded('vehicle') ? $order->getRelation('vehicle') : null;

                return [
                    'id' => $order->id,
                    'plate' => $vehicle?->plate,
                    'vehicle' => $vehicle
                        ? trim($vehicle->brand.' '.$vehicle->model_name)
                        : $order->getAttributes()['vehicle'] ?? null,
                    'client_name' => $order->clientRecord?->name,
                    'commercial' => $order->commercial?->name,
                    'items_count' => (int) $order->items_count,
                    // Pas d'horodatage de passage en TERMINE côté modèle : updated_at
                    // est le meilleur repère disponible (voir la vue atelier).
                    'days' => $order->updated_at ? (int) $order->updated_at->diffInDays(now()) : 0,
                    'amount' => round((float) $order->net_amount, 2),
                ];
            })->values()->all(),
        ];
    }

    /**
     * Références dont le stock restant est inférieur à ce qui s'est vendu sur
     * les 30 derniers jours : moins d'un mois de ventes en rayon.
     *
     * Aucun seuil de réapprovisionnement n'existe dans le modèle de données —
     * plutôt que d'en inventer un, la règle se lit sur les ventes réelles et ne
     * demande aucune saisie.
     */
    private function lowStock(): array
    {
        $since = Carbon::today()->subDays(30)->toDateString();

        $soldSub = DB::table('sale_items')
            ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
            ->where('sales.status', '!=', 'ANNULE')
            ->where('sales.date', '>=', $since)
            ->selectRaw('sale_items.product_id, SUM(sale_items.quantity) as sold')
            ->groupBy('sale_items.product_id');

        $stockSub = DB::table('stocks')
            ->selectRaw('product_id, SUM(quantity) as remaining')
            ->groupBy('product_id');

        $rows = DB::table('products')
            ->joinSub($soldSub, 'sold', 'sold.product_id', '=', 'products.id')
            ->leftJoinSub($stockSub, 'st', 'st.product_id', '=', 'products.id')
            ->leftJoin('product_tyres', 'product_tyres.product_id', '=', 'products.id')
            ->where('products.is_active', true)
            ->selectRaw("
                products.id,
                products.profile as name,
                products.reference,
                product_tyres.tire_width,
                product_tyres.tire_height,
                product_tyres.tire_diameter,
                COALESCE(st.remaining, 0) as remaining,
                sold.sold as sold_30d
            ")
            ->havingRaw('remaining < sold_30d')
            ->orderByRaw('remaining - sold_30d')
            ->get();

        return [
            'count' => $rows->count(),
            'rows' => $rows->take(self::ROWS_PER_GROUP)->map(fn ($r) => [
                'id' => (int) $r->id,
                'name' => $r->name,
                'reference' => $r->reference,
                'dimension' => $r->tire_width && $r->tire_height && $r->tire_diameter
                    ? $this->formatDimension($r->tire_width, $r->tire_height, $r->tire_diameter)
                    : null,
                'remaining' => (int) $r->remaining,
                'sold_30d' => (int) $r->sold_30d,
            ])->values()->all(),
        ];
    }

    private function formatDimension(float $width, float $height, float $diameter): string
    {
        return sprintf('%d/%dR%d', (int) $width, (int) $height, (int) $diameter);
    }

    /** Encaissements réels du jour (hors mouvements internes). */
    private function collectedToday(): float
    {
        return round((float) Transaction::query()
            ->settled()
            ->where('type', 'income')
            ->where(fn ($q) => $q->whereNull('category')->orWhere('category', '!=', 'Transfert'))
            ->whereDate('date', Carbon::today())
            ->sum('amount'), 2);
    }

    /** Ventes par jour sur 30 jours, pour l'histogramme du volet droit. */
    private function salesLast30Days(): array
    {
        $since = Carbon::today()->subDays(29);

        $byDate = Sale::query()
            ->where('status', '!=', 'ANNULE')
            ->whereDate('date', '>=', $since->toDateString())
            ->selectRaw('date, SUM(total_sale) as amount')
            ->groupBy('date')
            ->pluck('amount', 'date');

        $days = [];
        for ($i = 0; $i < 30; $i++) {
            $day = $since->copy()->addDays($i)->toDateString();
            $days[] = [
                'date' => $day,
                'amount' => round((float) ($byDate[$day] ?? 0), 2),
            ];
        }

        return $days;
    }
}
