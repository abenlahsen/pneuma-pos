<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class SalePrestationTest extends TestCase
{
    use DatabaseTransactions;

    protected function setUp(): void
    {
        parent::setUp();

        Permission::findOrCreate('view sales', 'web');
    }

    private function authenticateWithPermissions(array $permissions = []): User
    {
        $user = User::query()->create([
            'name' => 'Test User',
            'email' => fake()->unique()->safeEmail(),
            'password' => 'password',
            'phone' => '0600000000',
            'commission_rate' => 0,
            'must_change_password' => false,
        ]);

        if ($permissions !== []) {
            $user->givePermissionTo($permissions);
        }

        Sanctum::actingAs($user, [], 'web');

        return $user;
    }

    private function createPrestationProduct(string $reference, float $price): Product
    {
        $product = Product::query()->create([
            'reference' => $reference,
            'type' => 'service',
            'is_active' => true,
        ]);

        DB::table('product_services')->insert([
            'product_id' => $product->id,
            'category' => 'tires',
            'selling_price' => $price,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return $product;
    }

    public function test_index_requires_authentication()
    {
        $response = $this->getJson('/api/sale-prestations');

        $response->assertUnauthorized();
    }

    public function test_index_requires_view_sales_permission()
    {
        $this->authenticateWithPermissions();

        $response = $this->getJson('/api/sale-prestations');

        $response->assertForbidden();
    }

    public function test_index_returns_catalog_prestations()
    {
        $this->authenticateWithPermissions(['view sales']);

        $montage = $this->createPrestationProduct('SVC-MONTAGE-EQ', 30);
        $vt = $this->createPrestationProduct('SVC-PARAL-VT', 100);
        $suv = $this->createPrestationProduct('SVC-PARAL-SUV', 150);

        $response = $this->getJson('/api/sale-prestations');

        $response
            ->assertOk()
            ->assertJsonPath('montage.product_id', $montage->id)
            ->assertJsonPath('montage.default_price', 30)
            ->assertJsonPath('alignment_vt.product_id', $vt->id)
            ->assertJsonPath('alignment_vt.default_price', 100)
            ->assertJsonPath('alignment_suv.product_id', $suv->id)
            ->assertJsonPath('alignment_suv.default_price', 150);
    }

    public function test_index_returns_null_for_missing_prestation_product()
    {
        $this->authenticateWithPermissions(['view sales']);

        $response = $this->getJson('/api/sale-prestations');

        $response
            ->assertOk()
            ->assertJsonPath('montage', null)
            ->assertJsonPath('alignment_vt', null)
            ->assertJsonPath('alignment_suv', null);
    }
}
