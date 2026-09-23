<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Refonte 2b, 10a — le taux de TVA de la facture.
 *
 * L'application ne calcule aucune TVA : `sales.total_sale` est le montant que
 * le client paie, et `total_ht` dans le document imprimé recopiait cette même
 * valeur. La facture doit pourtant faire apparaître une base hors taxe et une
 * TVA.
 *
 * Décision retenue : `total_sale` est un TTC. Le hors-taxe et la taxe se
 * reconstituent à l'affichage, et le net réclamé reste rigoureusement celui de
 * la vente enregistrée. Le taux vit ici et non en dur dans le gabarit : il
 * change par décision fiscale, pas par livraison de code.
 *
 * 20 % par défaut — le taux normal marocain, celui de la maquette 19a.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('company_settings', function (Blueprint $table) {
            $table->decimal('vat_rate', 5, 2)->default(20)->after('holidays');
        });
    }

    public function down(): void
    {
        Schema::table('company_settings', function (Blueprint $table) {
            $table->dropColumn('vat_rate');
        });
    }
};
