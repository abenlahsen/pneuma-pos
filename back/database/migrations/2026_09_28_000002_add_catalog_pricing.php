<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Le prix catalogue et la remise client (étape 13, décision prix).
 *
 * Jusqu'ici aucun prix de vente n'était stocké : il se saisissait à chaque
 * vente. Le portail doit afficher « le prix du client » : un prix catalogue
 * par produit, moins une remise en pourcentage par client. Un tarif négocié
 * par client et par produit pourra s'ajouter plus tard (voir
 * App\Domain\Pricing\ClientPriceResolver) sans toucher à ces colonnes.
 *
 * Le prix catalogue est vide à la création ; la commande
 * `pricing:init-catalog` le remplit une fois (médiane des ventes à 90 jours,
 * à défaut prix d'achat du dernier lot × coefficient).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->decimal('catalog_price', 10, 2)->nullable()->after('unit');
        });

        Schema::table('clients', function (Blueprint $table) {
            $table->decimal('discount_rate', 5, 2)->default(0)->after('credit_limit');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn('catalog_price');
        });

        Schema::table('clients', function (Blueprint $table) {
            $table->dropColumn('discount_rate');
        });
    }
};
