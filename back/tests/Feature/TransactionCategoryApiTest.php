<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Transaction;
use App\Models\TransactionCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Route;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

class TransactionCategoryApiTest extends TestCase
{
    use DatabaseTransactions;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();

        if (! Route::has('login')) {
            Route::get('/login', fn () => response()->json(['message' => 'Unauthenticated.'], 401))->name('login');
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        foreach ([
            'view transaction-categories', 'create transaction-categories',
            'edit transaction-categories', 'delete transaction-categories',
            'view cash-flow', 'create cash-flow',
        ] as $perm) {
            Permission::findOrCreate($perm, 'web');
        }

        $admin = Role::findOrCreate('Administrator', 'web');
        $admin->syncPermissions(Permission::all());

        $this->user = User::query()->create([
            'name' => 'Admin',
            'email' => fake()->unique()->safeEmail(),
            'password' => 'password',
            'phone' => '0600000000',
            'commission_rate' => 0,
            'must_change_password' => false,
        ]);
        $this->user->assignRole($admin);
    }

    private function createUserWithPermissions(array $permissions): User
    {
        $user = User::query()->create([
            'name' => 'Guest User',
            'email' => fake()->unique()->safeEmail(),
            'password' => 'password',
            'phone' => '0600000001',
            'commission_rate' => 0,
            'must_change_password' => false,
        ]);

        if ($permissions !== []) {
            $user->givePermissionTo($permissions);
        }

        return $user;
    }

    private function createCategory(array $overrides = []): TransactionCategory
    {
        return TransactionCategory::query()->create(array_merge([
            'name' => 'Charge Test '.fake()->unique()->numerify('###'),
            'type' => 'expense',
            'parent_id' => null,
            'is_system' => false,
            'is_active' => true,
            'sort_order' => 0,
        ], $overrides));
    }

    // -------------------------------------------------------------------------
    // Authentication / permissions
    // -------------------------------------------------------------------------

    public function test_endpoints_require_authentication(): void
    {
        $category = $this->createCategory();

        $this->getJson('/api/transaction-categories')->assertUnauthorized();
        $this->postJson('/api/transaction-categories', ['name' => 'X', 'type' => 'expense'])->assertUnauthorized();
        $this->putJson("/api/transaction-categories/{$category->id}", ['name' => 'Y'])->assertUnauthorized();
        $this->deleteJson("/api/transaction-categories/{$category->id}")->assertUnauthorized();
    }

    public function test_index_requires_view_permission(): void
    {
        $guest = $this->createUserWithPermissions([]);
        Sanctum::actingAs($guest, [], 'web');

        $this->getJson('/api/transaction-categories')->assertForbidden();
    }

    public function test_store_requires_create_permission(): void
    {
        $guest = $this->createUserWithPermissions(['view transaction-categories']);
        Sanctum::actingAs($guest, [], 'web');

        $this->postJson('/api/transaction-categories', ['name' => 'X', 'type' => 'expense'])
            ->assertForbidden();
    }

    // -------------------------------------------------------------------------
    // Index
    // -------------------------------------------------------------------------

    public function test_index_returns_nested_categories_with_children(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $parent = $this->createCategory(['name' => 'Loyer', 'type' => 'expense']);
        $this->createCategory(['name' => 'Bureau', 'type' => 'expense', 'parent_id' => $parent->id]);

        $response = $this->getJson('/api/transaction-categories?type=expense');

        $response->assertOk();
        $rows = collect($response->json('data'))->keyBy('name');
        $this->assertArrayHasKey('Loyer', $rows->all());
        $this->assertCount(1, $rows['Loyer']['children']);
        $this->assertSame('Bureau', $rows['Loyer']['children'][0]['name']);
    }

    public function test_index_filters_by_type(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $this->createCategory(['name' => 'ExpenseOnly', 'type' => 'expense']);
        $this->createCategory(['name' => 'IncomeOnly', 'type' => 'income']);

        $response = $this->getJson('/api/transaction-categories?type=income');

        $response->assertOk();
        $names = collect($response->json('data'))->pluck('name');
        $this->assertTrue($names->contains('IncomeOnly'));
        $this->assertFalse($names->contains('ExpenseOnly'));
    }

    // -------------------------------------------------------------------------
    // Store
    // -------------------------------------------------------------------------

    public function test_store_creates_top_level_category(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $response = $this->postJson('/api/transaction-categories', [
            'name' => 'Loyer',
            'type' => 'expense',
        ]);

        $response->assertCreated()
            ->assertJsonPath('name', 'Loyer')
            ->assertJsonPath('type', 'expense')
            ->assertJsonPath('parent_id', null);

        $this->assertDatabaseHas('transaction_categories', ['name' => 'Loyer', 'type' => 'expense', 'parent_id' => null]);
    }

    public function test_store_creates_subcategory_under_parent(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $parent = $this->createCategory(['name' => 'Loyer', 'type' => 'expense']);

        $response = $this->postJson('/api/transaction-categories', [
            'name' => 'Bureau',
            'type' => 'expense',
            'parent_id' => $parent->id,
        ]);

        $response->assertCreated()->assertJsonPath('parent_id', $parent->id);
    }

    public function test_store_rejects_subcategory_of_a_subcategory(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $parent = $this->createCategory(['name' => 'Loyer', 'type' => 'expense']);
        $child = $this->createCategory(['name' => 'Bureau', 'type' => 'expense', 'parent_id' => $parent->id]);

        $response = $this->postJson('/api/transaction-categories', [
            'name' => 'Sous-bureau',
            'type' => 'expense',
            'parent_id' => $child->id,
        ]);

        $response->assertStatus(422);
        $this->assertDatabaseMissing('transaction_categories', ['name' => 'Sous-bureau']);
    }

    public function test_store_rejects_duplicate_name_within_same_parent_and_type(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $this->createCategory(['name' => 'Loyer', 'type' => 'expense']);

        $response = $this->postJson('/api/transaction-categories', [
            'name' => 'Loyer',
            'type' => 'expense',
        ]);

        $response->assertUnprocessable()->assertJsonValidationErrors('name');
    }

    public function test_store_allows_same_name_across_different_types(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $this->createCategory(['name' => 'Divers', 'type' => 'expense']);

        $response = $this->postJson('/api/transaction-categories', [
            'name' => 'Divers',
            'type' => 'income',
        ]);

        $response->assertCreated();
    }

    // -------------------------------------------------------------------------
    // Update
    // -------------------------------------------------------------------------

    public function test_update_requires_edit_permission(): void
    {
        $category = $this->createCategory();
        $guest = $this->createUserWithPermissions(['view transaction-categories']);
        Sanctum::actingAs($guest, [], 'web');

        $this->putJson("/api/transaction-categories/{$category->id}", ['name' => 'Renamed'])
            ->assertForbidden();
    }

    public function test_update_renames_category(): void
    {
        Sanctum::actingAs($this->user, [], 'web');
        $category = $this->createCategory(['name' => 'Old Name']);

        $response = $this->putJson("/api/transaction-categories/{$category->id}", ['name' => 'New Name']);

        $response->assertOk()->assertJsonPath('name', 'New Name');
    }

    public function test_update_persists_counts_as_expense_flag(): void
    {
        Sanctum::actingAs($this->user, [], 'web');
        $category = $this->createCategory(['name' => 'Charge Divers', 'counts_as_expense' => true]);

        $response = $this->putJson("/api/transaction-categories/{$category->id}", ['counts_as_expense' => false]);

        $response->assertOk()->assertJsonPath('counts_as_expense', false);
        $this->assertDatabaseHas('transaction_categories', ['id' => $category->id, 'counts_as_expense' => false]);
    }

    public function test_update_persists_counts_as_revenue_flag(): void
    {
        Sanctum::actingAs($this->user, [], 'web');
        $category = $this->createCategory(['name' => 'Occasion Test', 'type' => 'income', 'counts_as_revenue' => false]);

        $response = $this->putJson("/api/transaction-categories/{$category->id}", ['counts_as_revenue' => true]);

        $response->assertOk()->assertJsonPath('counts_as_revenue', true);
        $this->assertDatabaseHas('transaction_categories', ['id' => $category->id, 'counts_as_revenue' => true]);
    }

    // transactions.category stores the category name as a plain string (no
    // FK) — renaming a category must cascade to every transaction already
    // saved under the old name, otherwise they silently fall out of the
    // dashboard "Dépenses" KPI and fail revalidation on their next edit.
    public function test_update_rename_cascades_to_existing_transactions(): void
    {
        Sanctum::actingAs($this->user, [], 'web');
        $category = $this->createCategory(['name' => 'Old Name']);
        $account = Account::query()->create(['name' => 'Caisse Rename Test', 'type' => 'cash', 'initial_balance' => 0, 'is_active' => true]);
        $transaction = Transaction::query()->create([
            'date' => '2026-08-04',
            'amount' => 100,
            'type' => 'expense',
            'category' => 'Old Name',
            'method' => 'Espèces',
            'description' => 'Test',
            'person' => '',
            'user_id' => $this->user->id,
            'account_id' => $account->id,
        ]);

        $this->putJson("/api/transaction-categories/{$category->id}", ['name' => 'New Name'])->assertOk();

        $this->assertDatabaseHas('transactions', ['id' => $transaction->id, 'category' => 'New Name']);
    }

    public function test_update_rename_cascades_to_subcategory_only_under_its_parent(): void
    {
        Sanctum::actingAs($this->user, [], 'web');
        $parent = $this->createCategory(['name' => 'Loyer']);
        $child = $this->createCategory(['name' => 'Old Sub', 'parent_id' => $parent->id]);
        $account = Account::query()->create(['name' => 'Caisse Rename Test 2', 'type' => 'cash', 'initial_balance' => 0, 'is_active' => true]);
        $matching = Transaction::query()->create([
            'date' => '2026-08-04', 'amount' => 100, 'type' => 'expense',
            'category' => 'Loyer', 'subcategory' => 'Old Sub',
            'method' => 'Espèces', 'description' => 'Test', 'person' => '',
            'user_id' => $this->user->id, 'account_id' => $account->id,
        ]);
        // Same subcategory name under a different parent must not be touched.
        $otherParent = $this->createCategory(['name' => 'Transport']);
        $this->createCategory(['name' => 'Old Sub', 'parent_id' => $otherParent->id]);
        $unrelated = Transaction::query()->create([
            'date' => '2026-08-04', 'amount' => 100, 'type' => 'expense',
            'category' => 'Transport', 'subcategory' => 'Old Sub',
            'method' => 'Espèces', 'description' => 'Test', 'person' => '',
            'user_id' => $this->user->id, 'account_id' => $account->id,
        ]);

        $this->putJson("/api/transaction-categories/{$child->id}", ['name' => 'New Sub'])->assertOk();

        $this->assertDatabaseHas('transactions', ['id' => $matching->id, 'subcategory' => 'New Sub']);
        $this->assertDatabaseHas('transactions', ['id' => $unrelated->id, 'subcategory' => 'Old Sub']);
    }

    public function test_update_blocked_on_system_category(): void
    {
        Sanctum::actingAs($this->user, [], 'web');
        $category = $this->createCategory(['name' => 'Achat', 'is_system' => true]);

        $response = $this->putJson("/api/transaction-categories/{$category->id}", ['name' => 'Renamed']);

        $response->assertStatus(422);
        $this->assertDatabaseHas('transaction_categories', ['id' => $category->id, 'name' => 'Achat']);
    }

    // -------------------------------------------------------------------------
    // Delete
    // -------------------------------------------------------------------------

    public function test_delete_requires_delete_permission(): void
    {
        $category = $this->createCategory();
        $guest = $this->createUserWithPermissions(['view transaction-categories']);
        Sanctum::actingAs($guest, [], 'web');

        $this->deleteJson("/api/transaction-categories/{$category->id}")->assertForbidden();
    }

    public function test_delete_removes_unused_category(): void
    {
        Sanctum::actingAs($this->user, [], 'web');
        $category = $this->createCategory();

        $this->deleteJson("/api/transaction-categories/{$category->id}")->assertNoContent();

        $this->assertDatabaseMissing('transaction_categories', ['id' => $category->id]);
    }

    public function test_delete_blocked_on_system_category(): void
    {
        Sanctum::actingAs($this->user, [], 'web');
        $category = $this->createCategory(['name' => 'Produit', 'type' => 'income', 'is_system' => true]);

        $response = $this->deleteJson("/api/transaction-categories/{$category->id}");

        $response->assertStatus(422);
        $this->assertDatabaseHas('transaction_categories', ['id' => $category->id]);
    }

    public function test_delete_blocked_when_category_used_by_a_transaction(): void
    {
        Sanctum::actingAs($this->user, [], 'web');
        $category = $this->createCategory(['name' => 'Charge']);
        $account = Account::query()->create(['name' => 'Caisse Test', 'type' => 'cash', 'initial_balance' => 0, 'is_active' => true]);
        Transaction::query()->create([
            'date' => '2026-08-04',
            'amount' => 100,
            'type' => 'expense',
            'category' => 'Charge',
            'method' => 'Espèces',
            'description' => 'Test',
            'person' => '',
            'user_id' => $this->user->id,
            'account_id' => $account->id,
        ]);

        $response = $this->deleteJson("/api/transaction-categories/{$category->id}");

        $response->assertStatus(422);
        $this->assertDatabaseHas('transaction_categories', ['id' => $category->id]);
    }

    public function test_delete_parent_cascades_to_children(): void
    {
        Sanctum::actingAs($this->user, [], 'web');
        $parent = $this->createCategory(['name' => 'Loyer']);
        $child = $this->createCategory(['name' => 'Bureau', 'parent_id' => $parent->id]);

        $this->deleteJson("/api/transaction-categories/{$parent->id}")->assertNoContent();

        $this->assertDatabaseMissing('transaction_categories', ['id' => $child->id]);
    }

    // -------------------------------------------------------------------------
    // Integration with the Transaction store/update validation
    // -------------------------------------------------------------------------

    public function test_transaction_store_requires_category_from_the_catalog(): void
    {
        Sanctum::actingAs($this->user, [], 'web');
        $account = Account::query()->create(['name' => 'Caisse Test 2', 'type' => 'cash', 'initial_balance' => 0, 'is_active' => true]);

        $response = $this->postJson('/api/transactions', [
            'account_id' => $account->id,
            'type' => 'expense',
            'amount' => 50,
            'date' => '2026-08-04',
            'category' => 'Not A Real Category',
            'method' => 'Espèces',
            'person' => 'Test',
            'description' => 'Test',
        ]);

        $response->assertUnprocessable()->assertJsonValidationErrors('category');
    }

    public function test_transaction_store_accepts_valid_category_and_subcategory(): void
    {
        Sanctum::actingAs($this->user, [], 'web');
        $account = Account::query()->create(['name' => 'Caisse Test 3', 'type' => 'cash', 'initial_balance' => 0, 'is_active' => true]);
        $parent = $this->createCategory(['name' => 'Loyer']);
        $this->createCategory(['name' => 'Bureau', 'parent_id' => $parent->id]);

        $response = $this->postJson('/api/transactions', [
            'account_id' => $account->id,
            'type' => 'expense',
            'amount' => 50,
            'date' => '2026-08-04',
            'category' => 'Loyer',
            'subcategory' => 'Bureau',
            'method' => 'Espèces',
            'person' => 'Test',
            'description' => 'Test',
        ]);

        $response->assertCreated()
            ->assertJsonPath('category', 'Loyer')
            ->assertJsonPath('subcategory', 'Bureau');
    }

    public function test_transaction_store_rejects_subcategory_not_belonging_to_category(): void
    {
        Sanctum::actingAs($this->user, [], 'web');
        $account = Account::query()->create(['name' => 'Caisse Test 4', 'type' => 'cash', 'initial_balance' => 0, 'is_active' => true]);
        $this->createCategory(['name' => 'Loyer']);
        $otherParent = $this->createCategory(['name' => 'Transport']);
        $this->createCategory(['name' => 'Carburant', 'parent_id' => $otherParent->id]);

        $response = $this->postJson('/api/transactions', [
            'account_id' => $account->id,
            'type' => 'expense',
            'amount' => 50,
            'date' => '2026-08-04',
            'category' => 'Loyer',
            'subcategory' => 'Carburant',
            'method' => 'Espèces',
            'person' => 'Test',
            'description' => 'Test',
        ]);

        $response->assertUnprocessable()->assertJsonValidationErrors('subcategory');
    }
}
