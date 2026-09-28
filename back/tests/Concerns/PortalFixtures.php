<?php

namespace Tests\Concerns;

use App\Models\Brand;
use App\Models\Client;
use App\Models\ClientPortalAccount;
use App\Models\Payment;
use App\Models\Product;
use App\Models\Purchase;
use App\Models\PurchaseItem;
use App\Models\Sale;
use App\Models\SalePaymentAllocation;
use App\Models\Stock;
use App\Models\Supplier;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Testing\TestResponse;

/**
 * Données et sessions du portail (étape 13.2), avec de vrais jetons Bearer :
 * les gardes sont oubliées entre deux requêtes, comme entre deux requêtes
 * HTTP réelles.
 */
trait PortalFixtures
{
    protected User $staff;

    protected function makeStaff(): User
    {
        return $this->staff = User::query()->create([
            'name' => 'Équipe Portail',
            'email' => fake()->unique()->safeEmail(),
            'password' => 'password',
            'phone' => '0600000000',
            'commission_rate' => 0,
            'must_change_password' => false,
        ]);
    }

    /** @param  array<string, mixed>  $attributes */
    protected function portalClient(string $name, array $attributes = []): Client
    {
        return Client::query()->create($attributes + ['name' => $name, 'category' => 'Garage', 'is_active' => true]);
    }

    /** @return array{0: ClientPortalAccount, 1: string} un compte actif et son jeton */
    protected function portalSession(Client $client, string $email): array
    {
        $account = ClientPortalAccount::query()->create([
            'client_id' => $client->id,
            'name' => 'Contact '.$client->name,
            'email' => $email,
        ]);
        // Mot de passe et statut ne sont pas assignables en masse.
        $account->forceFill([
            'password' => 'Portail2026',
            'status' => ClientPortalAccount::STATUS_ACTIVE,
            'activated_at' => now(),
        ])->save();

        return [$account, $account->createToken('portal')->plainTextToken];
    }

    protected function portal(string $method, string $uri, ?string $token, array $data = []): TestResponse
    {
        $this->app['auth']->forgetGuards();
        $this->flushHeaders();

        return $token === null
            ? $this->json($method, $uri, $data)
            : $this->withToken($token)->json($method, $uri, $data);
    }

    /** Un pneu du catalogue, 205/55R16 91V par défaut. */
    protected function catalogTyre(string $profile, ?float $catalogPrice = 1000, int $width = 205, int $height = 55, int $diameter = 16, string $type = 'tyre'): Product
    {
        $brand = Brand::query()->firstOrCreate(['name' => 'Michelin'], ['is_active' => true]);
        $product = Product::query()->create([
            'profile' => $profile,
            'reference' => 'REF-PORTAIL-'.fake()->unique()->numerify('#####'),
            'type' => $type,
            'brand_id' => $brand->id,
            'is_active' => true,
            'catalog_price' => $catalogPrice,
        ]);

        if ($type === 'tyre') {
            DB::table('product_tyres')->insert([
                'product_id' => $product->id,
                'tire_width' => $width,
                'tire_height' => $height,
                'tire_diameter' => $diameter,
                'tire_load_index' => '91',
                'tire_speed_index' => 'V',
                'tire_season' => 'summer',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        return $product;
    }

    protected function lot(Product $product, int $quantity, float $purchasePrice = 600): Stock
    {
        return Stock::query()->create([
            'product_id' => $product->id,
            'quantity' => $quantity,
            'purchase_price' => $purchasePrice,
            'depot' => 'Casablanca',
            'dot' => '2426',
            'user_id' => $this->staff->id,
        ]);
    }

    protected function supplier(string $name, int $leadDays = 7): Supplier
    {
        return Supplier::query()->create(['name' => $name, 'delivery_lead_days' => $leadDays, 'user_id' => $this->staff->id]);
    }

    protected function purchase(Supplier $supplier, Product $product, Stock $stock, string $status, bool $stockApplied, int $quantity = 4, ?string $date = null): Purchase
    {
        $purchase = Purchase::query()->create([
            'date' => $date ?? now()->toDateString(),
            'supplier_id' => $supplier->id,
            'total_quantity' => $quantity,
            'total_price' => 600 * $quantity,
            'discount' => 0,
            'net_amount' => 600 * $quantity,
            'status' => $status,
            'payment_status' => 'NON PAYE',
            'created_by' => $this->staff->id,
        ]);
        $purchase->forceFill(['stock_applied' => $stockApplied])->save();
        PurchaseItem::query()->create([
            'purchase_id' => $purchase->id,
            'product_id' => $product->id,
            'stock_id' => $stock->id,
            'quantity' => $quantity,
            'unit_price' => 600,
        ]);

        return $purchase;
    }

    /** Une vente d'une ligne, avec commercial, partenaire, notes et marge — ce que le portail ne doit pas montrer. */
    protected function sale(Client $client, Product $product, float $total, string $date, string $status = 'LIVRE', bool $withInvoice = true): Sale
    {
        $stock = $this->lot($product, 0);
        $sale = Sale::query()->create([
            'date' => $date,
            'client_id' => $client->id,
            'with_invoice' => $withInvoice,
            'total_quantity' => 2,
            'total_purchase' => 1200,
            'total_sale' => $total,
            'margin' => $total - 1200,
            'status' => $status,
            'payment_status' => 'NON PAYE',
            'comments' => 'Note interne : client difficile',
            'created_by' => $this->staff->id,
            'commercial_id' => $this->staff->id,
        ]);
        DB::table('sale_items')->insert([
            'sale_id' => $sale->id,
            'product_id' => $product->id,
            'stock_id' => $stock->id,
            'quantity' => 2,
            'purchase_price' => 600,
            'selling_price' => $total / 2,
            'discount' => 0,
            'total_purchase' => 1200,
            'total_sale' => $total,
            'margin' => $total - 1200,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return $sale;
    }

    protected function pay(Sale $sale, float $amount, string $date): Payment
    {
        $payment = Payment::query()->create([
            'sale_id' => $sale->id,
            'client_id' => $sale->client_id,
            'amount' => $amount,
            'date' => $date,
            'method' => 'Virement',
            'notes' => 'Note interne paiement',
            'user_id' => $this->staff->id,
        ]);
        SalePaymentAllocation::query()->create(['payment_id' => $payment->id, 'sale_id' => $sale->id, 'amount' => $amount]);

        return $payment;
    }
}
