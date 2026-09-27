<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Le stock n'entre qu'à la réception.
 *
 * Jusqu'ici, tout achat non annulé était compté en stock dès sa création :
 * « le stock est-il entré ? » se déduisait du statut. Ce n'est plus vrai — un
 * achat « En cours » (attendu) n'entre plus en stock — mais les achats « En
 * cours » déjà en base, eux, y sont. La déduction ne tient donc plus : le fait
 * est enregistré dans `stock_applied`.
 *
 * Le remplissage recopie ce qui est vrai aujourd'hui, sans toucher ni aux
 * quantités ni aux statuts :
 *   - tout achat non annulé a fait entrer son stock ;
 *   - un achat annulé l'a retiré (PurchaseService::patchStatus), sauf celui
 *     que ses retours ont soldé : ses retours ont sorti les pneus un à un, et
 *     l'annulation automatique n'a rien retiré de plus.
 *
 * `received_at` est la date de réception. Elle n'est pas connue pour les
 * achats déjà reçus : elle reste vide plutôt que d'être inventée.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('purchases', function (Blueprint $table) {
            $table->boolean('stock_applied')->default(false)->after('status');
            $table->date('received_at')->nullable()->after('stock_applied');
        });

        DB::table('purchases')
            ->where('status', '!=', 'ANNULE')
            ->update(['stock_applied' => true]);

        DB::table('purchases')
            ->where('status', 'ANNULE')
            ->where('returned_quantity', '>', 0)
            ->whereColumn('returned_quantity', '>=', 'total_quantity')
            ->update(['stock_applied' => true]);
    }

    public function down(): void
    {
        Schema::table('purchases', function (Blueprint $table) {
            $table->dropColumn(['stock_applied', 'received_at']);
        });
    }
};
