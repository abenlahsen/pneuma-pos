<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Step 1: Drop old FK constraints first
        Schema::table('sales', function (Blueprint $table) {
            $table->dropForeign(['commercial_id']);
        });

        Schema::table('purchases', function (Blueprint $table) {
            $table->dropForeign(['commercial_id']);
        });

        // Step 2: Migrate personnels into users and build ID mapping
        if (Schema::hasTable('personnels')) {
            $personnels = DB::table('personnels')->get();
            $idMap = []; // old personnel_id => new user_id

            foreach ($personnels as $personnel) {
                // Check if a user already exists with the same email
                $existingUser = $personnel->email
                    ? DB::table('users')->where('email', $personnel->email)->first()
                    : null;

                if ($existingUser) {
                    $idMap[$personnel->id] = $existingUser->id;
                } else {
                    $newUserId = DB::table('users')->insertGetId([
                        'name' => $personnel->name,
                        'email' => $personnel->email ?? strtolower(str_replace(' ', '.', $personnel->name)) . '@pneuma.pos',
                        'password' => Hash::make('password'),
                        'phone' => $personnel->phone,
                        'commission_rate' => $personnel->commission_rate,
                        'must_change_password' => true,
                        'created_at' => $personnel->created_at,
                        'updated_at' => now(),
                    ]);
                    $idMap[$personnel->id] = $newUserId;
                }
            }

            // Step 3: Remap commercial_id using CASE to avoid cascading overwrites
            if (!empty($idMap)) {
                $caseExpr = 'CASE commercial_id';
                foreach ($idMap as $oldId => $newId) {
                    $caseExpr .= " WHEN {$oldId} THEN {$newId}";
                }
                $caseExpr .= ' ELSE commercial_id END';

                $oldIds = implode(',', array_keys($idMap));

                DB::statement("UPDATE sales SET commercial_id = {$caseExpr} WHERE commercial_id IN ({$oldIds})");
                DB::statement("UPDATE purchases SET commercial_id = {$caseExpr} WHERE commercial_id IN ({$oldIds})");
            }
        }

        // Step 4: Add new FK to users
        Schema::table('sales', function (Blueprint $table) {
            $table->foreign('commercial_id')->references('id')->on('users')->nullOnDelete();
        });

        Schema::table('purchases', function (Blueprint $table) {
            $table->foreign('commercial_id')->references('id')->on('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $table->dropForeign(['commercial_id']);
            $table->foreign('commercial_id')->references('id')->on('personnels')->nullOnDelete();
        });

        Schema::table('purchases', function (Blueprint $table) {
            $table->dropForeign(['commercial_id']);
            $table->foreign('commercial_id')->references('id')->on('personnels')->nullOnDelete();
        });
    }
};
