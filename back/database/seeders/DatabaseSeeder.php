<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call(RolesAndPermissionsSeeder::class);

        $admin = User::firstOrCreate(
            ['email' => 'admin@pneuma.pos'],
            [
                'name' => 'Admin POS',
                'password' => bcrypt('password'),
            ]
        );

        $admin->assignRole('Administrator');
    }
}
