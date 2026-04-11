<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call(RolesAndPermissionsSeeder::class);

        $email = env('ADMIN_EMAIL', 'admin@pneuma.pos');
        $generated = null;
        $initialPassword = env('ADMIN_INITIAL_PASSWORD');

        if (empty($initialPassword)) {
            $generated = Str::password(16);
            $initialPassword = $generated;
        }

        $existed = User::where('email', $email)->exists();

        $admin = User::firstOrCreate(
            ['email' => $email],
            [
                'name' => 'Admin POS',
                'password' => bcrypt($initialPassword),
                'must_change_password' => true,
            ]
        );

        $admin->assignRole('Administrator');

        if (! $existed && $generated !== null) {
            $this->command?->warn("Initial admin password for {$email}: {$generated}");
            $this->command?->warn('This password must be changed on first login.');
        } elseif (! $existed) {
            $this->command?->info("Admin user {$email} created with ADMIN_INITIAL_PASSWORD from env.");
        }
    }
}
