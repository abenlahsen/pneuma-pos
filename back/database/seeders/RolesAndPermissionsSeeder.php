<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class RolesAndPermissionsSeeder extends Seeder
{
    public function run(): void
    {
        $permissions = [
            'view clients',
            'create clients',
            'edit clients',
            'delete clients',
        ];

        foreach ($permissions as $permission) {
            Permission::findOrCreate($permission);
        }

        $administrator = Role::findOrCreate('Administrator');
        $manager = Role::findOrCreate('Manager');
        $commercial = Role::findOrCreate('Commercial');

        $administrator->givePermissionTo($permissions);
        $manager->givePermissionTo($permissions);
        $commercial->givePermissionTo([
            'view clients',
            'create clients',
        ]);
    }
}