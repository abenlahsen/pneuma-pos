<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Refonte 2b, 12a — la quantité de pièce réellement sortie du stock.
 *
 * StockDeductionService prélève une pièce sur un seul lot, dans la limite de
 * ce qu'il contient : pour 2 plaquettes demandées et 1 en stock, il en sort 1.
 * Mais restoreForOrder() rendait la quantité de la ligne, 2 — chaque
 * modification ou annulation d'une intervention en rupture créait du stock
 * fantôme. L'ancien formulaire limitait le cas en refusant d'enregistrer une
 * pièce en rupture ; l'écran 12a doit l'accepter (« Commander la pièce »).
 *
 * La restauration rend désormais exactement ce qui a été sorti.
 *
 * Reprise de l'existant : une pièce rattachée à un lot, sur une intervention
 * non annulée, est comptée comme entièrement sortie — c'est ce que la
 * restauration supposait jusqu'ici, on ne change donc rien à son effet pour
 * les données passées. Une intervention annulée a déjà été restaurée : 0.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('service_items', function (Blueprint $table) {
            $table->unsignedInteger('deducted_quantity')->default(0)->after('stock_id');
        });

        DB::table('service_items')
            ->join('service_orders', 'service_orders.id', '=', 'service_items.service_order_id')
            ->where('service_items.item_type', 'part')
            ->whereNotNull('service_items.stock_id')
            ->where('service_orders.status', '!=', 'ANNULE')
            ->update(['service_items.deducted_quantity' => DB::raw('service_items.quantity')]);
    }

    public function down(): void
    {
        Schema::table('service_items', function (Blueprint $table) {
            $table->dropColumn('deducted_quantity');
        });
    }
};
