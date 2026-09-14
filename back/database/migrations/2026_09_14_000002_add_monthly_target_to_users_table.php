<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Objectif mensuel de chiffre d'affaires, par commercial.
 *
 * Nullable a dessein : la barre de progression de l'accueil ne s'affiche que
 * lorsque l'objectif est renseigne. Mieux vaut pas de barre du tout qu'une
 * barre a 0 % pour quelqu'un a qui on n'a jamais fixe d'objectif.
 */
return new class extends Migration
{
    public function up()
    {
        Schema::table('users', function (Blueprint $table) {
            $table->decimal('monthly_target', 12, 2)->nullable()->after('prime_per_tyre')
                ->comment('Objectif mensuel de CA ; null = aucun objectif fixe');
        });
    }

    public function down()
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('monthly_target');
        });
    }
};
