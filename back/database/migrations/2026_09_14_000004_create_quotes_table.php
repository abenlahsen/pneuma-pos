<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Devis.
 *
 * Cree pour la quatrieme file de l'accueil, « Devis sans reponse » : elle a
 * besoin d'une reference, d'un client, d'une date d'emission, d'un montant et
 * d'un porteur. C'est le strict necessaire de cette file.
 *
 * Deliberement sans lignes de devis ni conversion en vente : il n'existe aucun
 * ecran de saisie, et inventer un modele complet sans savoir comment l'atelier
 * etablit ses devis serait pire que ce minimum.
 *
 * « Sans reponse » se lit `responded_at IS NULL` : un devis accepte ou refuse
 * a une date de reponse, et sort de la file.
 */
return new class extends Migration
{
    public function up()
    {
        Schema::create('quotes', function (Blueprint $table) {
            $table->id();
            $table->string('reference')->unique();
            $table->foreignId('client_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('commercial_id')->nullable()->constrained('users')->nullOnDelete();
            $table->date('issued_at');
            $table->date('valid_until')->nullable();
            $table->decimal('total_amount', 12, 2)->default(0);
            $table->string('status')->default('ENVOYE')
                ->comment('ENVOYE | ACCEPTE | REFUSE | ANNULE');
            $table->dateTime('responded_at')->nullable()
                ->comment('Null = sans reponse, c\'est ce que la file de l\'accueil remonte');
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['status', 'responded_at']);
            $table->index('commercial_id');
        });
    }

    public function down()
    {
        Schema::dropIfExists('quotes');
    }
};
