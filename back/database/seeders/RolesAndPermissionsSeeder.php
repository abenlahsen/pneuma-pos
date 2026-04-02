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
            'stock' => ['view', 'create', 'edit', 'delete', 'import'],
        ];

        // Create permissions
        foreach ($resources as $resource => $actions) {
            foreach ($actions as $action) {
                Permission::firstOrCreate(['name' => "{$action} {$resource}", 'guard_name' => 'web']);
            }
        }

        // Create roles and assign default permissions (only on first creation)
        $admin = Role::firstOrCreate(['name' => 'Administrator', 'guard_name' => 'web']);
        if ($admin->wasRecentlyCreated) {
            $admin->syncPermissions(Permission::all());
        } else {
            // Always give admin any new permissions
            $admin->givePermissionTo(Permission::all());
        }

        $commercial = Role::firstOrCreate(['name' => 'Commercial', 'guard_name' => 'web']);
        if ($commercial->wasRecentlyCreated) {
            $commercial->syncPermissions([
                'view sales', 'create sales',
                'manage sale-payments',
                'view suppliers',
                'view carriers',
                'view partners',
            ]);
        }

        $manager = Role::firstOrCreate(['name' => 'Manager', 'guard_name' => 'web']);
        if ($manager->wasRecentlyCreated) {
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
                'view stock',
            ]);
        }

        $driver = Role::firstOrCreate(['name' => 'Driver', 'guard_name' => 'web']);
        if ($driver->wasRecentlyCreated) {
            $driver->syncPermissions([
                'view sales',
                'view carriers',
            ]);
        }

        // Assign Administrator role to admin user if exists
        $adminUser = \App\Models\User::where('email', 'admin@pneuma.pos')->first();
        if ($adminUser && !$adminUser->hasRole('Administrator')) {
            $adminUser->assignRole('Administrator');
        }
    }
}
