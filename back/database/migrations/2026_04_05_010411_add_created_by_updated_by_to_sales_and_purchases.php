<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::table('sales', function (Blueprint $table) {
            if (!Schema::hasColumn('sales', 'created_by')) {
                $table->foreignId('created_by')->nullable()->after('comments')->constrained('users')->nullOnDelete();
            }
            if (!Schema::hasColumn('sales', 'updated_by')) {
                $table->foreignId('updated_by')->nullable()->after('created_by')->constrained('users')->nullOnDelete();
            }
        });

        // Migrate existing user_id data to created_by
        if (Schema::hasColumn('sales', 'user_id')) {
            DB::statement('UPDATE sales SET created_by = user_id WHERE created_by IS NULL');
            Schema::table('sales', function (Blueprint $table) {
                $table->dropForeign(['user_id']);
                $table->dropColumn('user_id');
            });
        }

        Schema::table('purchases', function (Blueprint $table) {
            if (!Schema::hasColumn('purchases', 'created_by')) {
                $table->foreignId('created_by')->nullable()->after('payment_date')->constrained('users')->nullOnDelete();
            }
            if (!Schema::hasColumn('purchases', 'updated_by')) {
                $table->foreignId('updated_by')->nullable()->after('created_by')->constrained('users')->nullOnDelete();
            }
        });
    }

    public function down()
    {
        Schema::table('sales', function (Blueprint $table) {
            if (!Schema::hasColumn('sales', 'user_id')) {
                $table->foreignId('user_id')->nullable()->after('comments')->constrained('users')->nullOnDelete();
            }
        });

        if (Schema::hasColumn('sales', 'created_by')) {
            DB::statement('UPDATE sales SET user_id = created_by WHERE user_id IS NULL');
            Schema::table('sales', function (Blueprint $table) {
                $table->dropForeign(['created_by']);
                $table->dropColumn('created_by');
            });
        }

        Schema::table('sales', function (Blueprint $table) {
            if (Schema::hasColumn('sales', 'updated_by')) {
                $table->dropForeign(['updated_by']);
                $table->dropColumn('updated_by');
            }
        });

        Schema::table('purchases', function (Blueprint $table) {
            if (Schema::hasColumn('purchases', 'created_by')) {
                $table->dropForeign(['created_by']);
                $table->dropColumn('created_by');
            }
            if (Schema::hasColumn('purchases', 'updated_by')) {
                $table->dropForeign(['updated_by']);
                $table->dropColumn('updated_by');
            }
        });
    }
};
