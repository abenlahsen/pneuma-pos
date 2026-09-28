<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Les accès portail des clients (étape 13.1).
 *
 * Un client n'est pas un User : table, garde et jetons à part. Plusieurs
 * comptes par client (un garage a souvent un gérant et un comptable).
 *
 * Les jetons d'activation et de réinitialisation ne sont stockés que hachés
 * (sha256) : la base ne contient jamais un lien utilisable.
 *
 * `client_id` passe à null si le client est supprimé : le compte a été
 * suspendu juste avant (Client::deleting), et la trace de l'accès reste.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('client_portal_accounts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('client_id')->nullable()->constrained('clients')->nullOnDelete();
            $table->string('name');
            $table->string('email')->unique();
            $table->string('password')->nullable();
            // INVITE → ACTIF ; SUSPENDU à tout moment.
            $table->string('status', 20)->default('INVITE')->index();

            $table->string('activation_token_hash', 64)->nullable()->unique();
            $table->timestamp('activation_expires_at')->nullable();
            $table->string('reset_token_hash', 64)->nullable()->unique();
            $table->timestamp('reset_expires_at')->nullable();

            $table->timestamp('invited_at')->nullable();
            $table->foreignId('invited_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('activated_at')->nullable();
            $table->timestamp('last_login_at')->nullable();
            $table->timestamp('suspended_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('client_portal_accounts');
    }
};
