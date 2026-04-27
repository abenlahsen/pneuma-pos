<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Safety: if the old column is already gone, nothing to migrate.
        if (! Schema::hasColumn('sales', 'client')) {
            return;
        }

        // For each unique client name, pick the most frequently used city and
        // payment_method across their sales (most common value wins).
        $rows = DB::table('sales')
            ->select('client', DB::raw('MAX(client_phone) as client_phone'))
            ->whereNotNull('client')
            ->where('client', '!=', '')
            ->groupBy('client')
            ->orderBy('client')
            ->get();

        foreach ($rows as $row) {
            // Most frequent city for this client.
            $city = DB::table('sales')
                ->select('city', DB::raw('COUNT(*) as cnt'))
                ->where('client', $row->client)
                ->whereNotNull('city')
                ->where('city', '!=', '')
                ->groupBy('city')
                ->orderByDesc('cnt')
                ->value('city');

            // Most frequent payment method for this client.
            $paymentMethod = DB::table('sales')
                ->select('payment_method', DB::raw('COUNT(*) as cnt'))
                ->where('client', $row->client)
                ->whereNotNull('payment_method')
                ->where('payment_method', '!=', '')
                ->groupBy('payment_method')
                ->orderByDesc('cnt')
                ->value('payment_method');

            $existing = DB::table('clients')->where('name', $row->client)->first();

            if ($existing) {
                $clientId = $existing->id;
                $update = [];
                if (empty($existing->phone) && ! empty($row->client_phone)) {
                    $update['phone'] = $row->client_phone;
                }
                if (empty($existing->city) && ! empty($city)) {
                    $update['city'] = $city;
                }
                if (empty($existing->default_payment_method) && ! empty($paymentMethod)) {
                    $update['default_payment_method'] = $paymentMethod;
                }
                if ($update) {
                    $update['updated_at'] = now();
                    DB::table('clients')->where('id', $clientId)->update($update);
                }
            } else {
                $clientId = DB::table('clients')->insertGetId([
                    'name'                   => $row->client,
                    'phone'                  => $row->client_phone,
                    'city'                   => $city,
                    'default_payment_method' => $paymentMethod,
                    'is_active'              => true,
                    'created_at'             => now(),
                    'updated_at'             => now(),
                ]);
            }

            DB::table('sales')
                ->where('client', $row->client)
                ->whereNull('client_id')
                ->update(['client_id' => $clientId]);
        }
    }

    public function down(): void
    {
        // Not reversible: cannot restore free-text columns from the clients table.
    }
};
