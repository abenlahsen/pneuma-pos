<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class RolesAndPermissionsSeeder extends Seeder
{
    public function run()
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
            'accounts' => ['view', 'create', 'edit', 'delete', 'transfer'],
            'users' => ['view', 'create', 'edit', 'delete'],
            'roles' => ['view', 'create', 'edit', 'delete'],
            'stock' => ['view', 'create', 'edit', 'delete', 'import'],
            'stock-movements' => ['view'],
            'brands' => ['view', 'create', 'edit', 'delete'],
            'products' => ['view', 'create', 'edit', 'delete'],
            'settings' => ['view', 'edit'],
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
                'view products',
                'view brands',
                'view settings',
            ]);
        } else {
            $commercial->givePermissionTo([
                'view products',
                'view brands',
                'view settings',
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
                'view accounts',
                'view stock',
                'view stock-movements',
                'view products', 'create products', 'edit products', 'delete products',
                'view brands', 'create brands', 'edit brands', 'delete brands',
                'view settings', 'edit settings',
            ]);
        } else {
            // Ensure Manager gets new permissions added after initial creation
            $manager->givePermissionTo([
                'view products', 'create products', 'edit products', 'delete products',
                'view brands', 'create brands', 'edit brands', 'delete brands',
                'view stock-movements',
                'view accounts', 'create accounts', 'edit accounts', 'delete accounts', 'transfer accounts',
                'view settings', 'edit settings',
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
        if ($adminUser && ! $adminUser->hasRole('Administrator')) {
            $adminUser->assignRole('Administrator');
        }
    }
}
