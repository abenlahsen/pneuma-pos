<?php

namespace Tests\Feature;

use App\Domain\Transactions\TransactionService;
use App\Models\Account;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

/**
 * Solde apres chaque mouvement (`3g` du handoff).
 *
 * C'est la colonne qui permet de retrouver le jour ou la tresorerie a bascule
 * sans sortir de l'ecran. Elle n'est juste que si elle est calculee sur TOUS
 * les mouvements du compte : un cumul fait sur la page affichee, ou sur un
 * sous-ensemble filtre, donnerait un chiffre faux et credible — le pire des
 * deux mondes.
 */
class TransactionRunningBalanceTest extends TestCase
{
    use DatabaseTransactions;

    private User $user;

    private Account $account;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::query()->create([
            'name' => 'Caissier',
            'email' => fake()->unique()->safeEmail(),
            'password' => 'password',
            'phone' => '0600000000',
            'commission_rate' => 0,
            'must_change_password' => false,
        ]);

        $this->account = Account::query()->create([
            'name' => 'Caisse '.fake()->unique()->numerify('###'),
            'type' => 'cash',
            'initial_balance' => 1000,
            'is_active' => true,
        ]);
    }

    private function move(string $date, string $type, float $amount, string $category = 'Divers'): Transaction
    {
        return Transaction::query()->create([
            'date' => $date,
            'amount' => $amount,
            'type' => $type,
            'category' => $category,
            'method' => 'Espèces',
            'description' => $type.' '.$amount,
            'person' => '',
            'user_id' => $this->user->id,
            'account_id' => $this->account->id,
        ]);
    }

    private function balances(array $filters = []): array
    {
        $rows = app(TransactionService::class)
            ->list(array_merge(['account_id' => $this->account->id, 'per_page' => 50], $filters), true);

        return collect($rows->items())
            ->mapWithKeys(fn ($t) => [$t->id => $t->balance_after])
            ->all();
    }

    public function test_running_balance_starts_from_the_account_initial_balance(): void
    {
        $first = $this->move('2026-03-01', 'income', 500);

        $this->assertEqualsWithDelta(1500, $this->balances()[$first->id], 0.01);
    }

    public function test_each_movement_carries_the_balance_that_followed_it(): void
    {
        $a = $this->move('2026-03-01', 'income', 500);    // 1000 + 500 = 1500
        $b = $this->move('2026-03-02', 'expense', 200);   // 1500 - 200 = 1300
        $c = $this->move('2026-03-03', 'income', 100);    // 1300 + 100 = 1400

        $balances = $this->balances();

        $this->assertEqualsWithDelta(1500, $balances[$a->id], 0.01);
        $this->assertEqualsWithDelta(1300, $balances[$b->id], 0.01);
        $this->assertEqualsWithDelta(1400, $balances[$c->id], 0.01);
    }

    public function test_a_filter_does_not_distort_the_balance(): void
    {
        $this->move('2026-03-01', 'income', 500);        // 1500
        $expense = $this->move('2026-03-02', 'expense', 200);  // 1300

        // On ne regarde que les depenses : le solde affiche doit rester celui
        // du compte (1300), pas le cumul des seules depenses (-200 ou 800).
        $balances = $this->balances(['type' => 'expense']);

        $this->assertEqualsWithDelta(1300, $balances[$expense->id], 0.01);
    }

    public function test_movements_of_another_account_do_not_count(): void
    {
        $other = Account::query()->create([
            'name' => 'Banque '.fake()->unique()->numerify('###'),
            'type' => 'bank',
            'initial_balance' => 50000,
            'is_active' => true,
        ]);

        Transaction::query()->create([
            'date' => '2026-03-01',
            'amount' => 9999,
            'type' => 'income',
            'category' => 'Divers',
            'method' => 'Virement',
            'description' => 'autre compte',
            'person' => '',
            'user_id' => $this->user->id,
            'account_id' => $other->id,
        ]);

        $mine = $this->move('2026-03-02', 'income', 500);

        $this->assertEqualsWithDelta(1500, $this->balances()[$mine->id], 0.01);
    }

    public function test_two_movements_on_the_same_day_are_ordered_by_id(): void
    {
        $first = $this->move('2026-03-01', 'income', 500);   // 1500
        $second = $this->move('2026-03-01', 'expense', 300); // 1200

        $balances = $this->balances();

        $this->assertEqualsWithDelta(1500, $balances[$first->id], 0.01);
        $this->assertEqualsWithDelta(1200, $balances[$second->id], 0.01);
    }

    // Pas de test « mouvement sans compte » : transactions.account_id est
    // NOT NULL, le cas ne peut pas exister. Le garde-fou reste dans le
    // service au cas ou la colonne deviendrait nullable.
}
