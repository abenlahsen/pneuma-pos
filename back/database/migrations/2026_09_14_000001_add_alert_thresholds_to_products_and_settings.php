<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Seuil de reapprovisionnement (file « Produits sous seuil » de l'accueil).
 *
 * Deux niveaux : un seuil propre a l'article, et un defaut d'agence quand il
 * n'en porte pas. Un 205/55R16 courant et un pneu SUV rare n'ont pas le meme
 * seuil ; un seuil unique produirait surtout du bruit.
 *
 * Les deux sont nullables et le resultat vaut zero par defaut : sans seuil
 * configure, aucun article ne remonte. La file se remplit quand on le decide,
 * pas le jour de la migration.
 */
return new class extends Migration
{
    public function up()
    {
        Schema::table('products', function (Blueprint $table) {
            $table->unsignedInteger('alert_threshold')->nullable()->after('reference')
                ->comment('Seuil de reappro propre a l\'article ; null = defaut d\'agence');
        });

        Schema::table('company_settings', function (Blueprint $table) {
            $table->unsignedInteger('default_alert_threshold')->nullable()->after('prime_threshold')
                ->comment('Seuil de reappro applique aux articles sans seuil propre');
        });
    }

    public function down()
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn('alert_threshold');
        });

        Schema::table('company_settings', function (Blueprint $table) {
            $table->dropColumn('default_alert_threshold');
        });
    }
};
