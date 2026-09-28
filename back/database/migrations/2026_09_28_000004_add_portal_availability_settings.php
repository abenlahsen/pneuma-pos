<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * La disponibilité montrée au client du portail (étape 13.2).
 *
 * Le client ne voit jamais une quantité : un niveau, calculé côté serveur.
 *   - quantité ≥ seuil (8 par défaut)         → Disponible
 *   - 1 à seuil − 1                           → Stock limité
 *   - 0, avec un achat attendu                → Sous 24 h
 *   - 0, sans achat attendu                   → Sur commande · délai du fournisseur
 *
 * Le délai de livraison d'un fournisseur (7 jours par défaut) se règle sur
 * sa fiche ; le seuil « Disponible », dans les Paramètres.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('suppliers', function (Blueprint $table) {
            $table->unsignedSmallInteger('delivery_lead_days')->default(7)->after('payment_terms_days');
        });

        Schema::table('company_settings', function (Blueprint $table) {
            $table->unsignedSmallInteger('portal_available_threshold')->default(8);
        });
    }

    public function down(): void
    {
        Schema::table('suppliers', function (Blueprint $table) {
            $table->dropColumn('delivery_lead_days');
        });

        Schema::table('company_settings', function (Blueprint $table) {
            $table->dropColumn('portal_available_threshold');
        });
    }
};
