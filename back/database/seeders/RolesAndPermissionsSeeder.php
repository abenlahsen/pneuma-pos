<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class RolesAndPermissionsSeeder extends Seeder
{
    public function run(): void
    {
        // Reset cached roles and permissions
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        $resources = [
            'sales' => ['view', 'create', 'edit', 'delete'],
            'purchases' => ['view', 'create', 'edit', 'delete'],
            'sale-payments' => ['manage'],
            'purchase-payments' => ['manage'],
            'suppliers' => ['view', 'create', 'edit', 'delete'],
            'carriers' => ['view', 'create', 'edit', 'delete'],
            'partners' => ['view', 'create', 'edit', 'delete'],
            'cash-flow' => ['view', 'create', 'edit', 'delete'],
            'users' => ['view', 'create', 'edit', 'delete'],
            'roles' => ['view', 'create', 'edit', 'delete'],
        ];

        // Create permissions
        foreach ($resources as $resource => $actions) {
            foreach ($actions as $action) {
                Permission::firstOrCreate(['name' => "{$action} {$resource}", 'guard_name' => 'web']);
            }
        }

        // Create roles and assign permissions
        $admin = Role::firstOrCreate(['name' => 'Administrator', 'guard_name' => 'web']);
        $admin->syncPermissions(Permission::all());

        $commercial = Role::firstOrCreate(['name' => 'Commercial', 'guard_name' => 'web']);
        $commercial->syncPermissions([
            'view sales', 'create sales',
            'manage sale-payments',
            'view suppliers',
            'view carriers',
            'view partners',
        ]);

        $manager = Role::firstOrCreate(['name' => 'Manager', 'guard_name' => 'web']);
        $manager->syncPermissions([
            'view sales', 'create sales', 'edit sales', 'delete sales',
            'manage sale-payments',
            'view purchases', 'create purchases', 'edit purchases', 'delete purchases',
            'manage purchase-payments',
            'view suppliers', 'create suppliers', 'edit suppliers',
            'view users',
            'view carriers', 'create carriers', 'edit carriers',
            'view partners', 'create partners', 'edit partners',
            'view cash-flow',
        ]);

        $driver = Role::firstOrCreate(['name' => 'Driver', 'guard_name' => 'web']);
        $driver->syncPermissions([
            'view sales',
            'view carriers',
        ]);
    }
}
