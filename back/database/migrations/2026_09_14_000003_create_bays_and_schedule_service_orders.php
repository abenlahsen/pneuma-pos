<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Planning de l'atelier (`3f`).
 *
 * Un ordre de reparation a une duree, une baie et un technicien. Sans ces trois
 * informations le planning ne peut rien placer : la carte est positionnee en
 * absolu depuis `top = (debut − 09:00) / 8 h` et `height = duree / 8 h`, donc il
 * faut une heure de debut et une duree, pas seulement une date.
 *
 * Les baies sont une table plutot qu'un entier : chacune porte le technicien qui
 * y travaille, et l'atelier peut en ajouter une sans migration.
 */
return new class extends Migration
{
    public function up()
    {
        Schema::create('bays', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete()
                ->comment('Technicien affecte a la baie');
            $table->unsignedSmallInteger('position')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::table('service_orders', function (Blueprint $table) {
            $table->dateTime('scheduled_at')->nullable()->after('date')
                ->comment('Debut planifie ; null = encore dans la file d\'attente');
            $table->unsignedSmallInteger('duration_minutes')->nullable()->after('scheduled_at');
            $table->foreignId('bay_id')->nullable()->after('duration_minutes')
                ->constrained()->nullOnDelete();
        });

        // Quatre baies, une par technicien — decide avec l'atelier.
        foreach ([1, 2, 3, 4] as $i) {
            DB::table('bays')->insert([
                'name' => 'Baie '.$i,
                'position' => $i,
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function down()
    {
        Schema::table('service_orders', function (Blueprint $table) {
            $table->dropConstrainedForeignId('bay_id');
            $table->dropColumn(['scheduled_at', 'duration_minutes']);
        });

        Schema::dropIfExists('bays');
    }
};
