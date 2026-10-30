<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Le personnalisateur de thème a quitté l'écran Paramètres à l'étape 7a de la
 * refonte 2b : ses trois couleurs ne pilotaient plus rien (aucune feuille ne
 * lit --app-primary, --app-accent ni --app-surface), menu_layout et
 * navbar_variant décrivaient une barre de navigation disparue à l'étape 3, et
 * theme_mode passait à moitié l'application en sombre sur un poste réglé en
 * sombre — fond bleu nuit, titres illisibles, cartes restées blanches.
 *
 * content_width reste : c'est le seul de ces réglages qu'une règle CSS lit
 * encore (app.scss, data-content-width).
 *
 * down() recrée les colonnes avec leurs défauts d'origine, pas les valeurs
 * qu'elles portaient.
 */
return new class extends Migration
{
    private const COLUMNS = [
        'theme_mode',
        'primary_color',
        'accent_color',
        'surface_color',
        'menu_layout',
        'navbar_variant',
    ];

    public function up(): void
    {
        $present = array_values(array_filter(
            self::COLUMNS,
            fn (string $column) => Schema::hasColumn('company_settings', $column),
        ));

        if ($present === []) {
            return;
        }

        Schema::table('company_settings', function (Blueprint $table) use ($present) {
            $table->dropColumn($present);
        });
    }

    public function down(): void
    {
        Schema::table('company_settings', function (Blueprint $table) {
            if (! Schema::hasColumn('company_settings', 'theme_mode')) {
                $table->string('theme_mode')->default('system')->after('favicon_path');
            }

            if (! Schema::hasColumn('company_settings', 'primary_color')) {
                $table->string('primary_color', 7)->default('#ff2d37')->after('theme_mode');
            }

            if (! Schema::hasColumn('company_settings', 'accent_color')) {
                $table->string('accent_color', 7)->default('#1e293b')->after('primary_color');
            }

            if (! Schema::hasColumn('company_settings', 'surface_color')) {
                $table->string('surface_color', 7)->default('#ffffff')->after('accent_color');
            }

            if (! Schema::hasColumn('company_settings', 'menu_layout')) {
                $table->string('menu_layout')->default('vertical')->after('surface_color');
            }

            if (! Schema::hasColumn('company_settings', 'navbar_variant')) {
                $table->string('navbar_variant')->default('default')->after('menu_layout');
            }
        });
    }
};
