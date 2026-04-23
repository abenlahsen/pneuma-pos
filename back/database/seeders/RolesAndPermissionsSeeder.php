<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class RolesAndPermissionsSeeder extends Seeder
{
    public function run(): void
    {
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        $permissions = [
            // Sales
            'view sales',
            'create sales',
            'edit sales',
            'delete sales',
            'manage sale-payments',

            // Purchases
            'view purchases',
            'create purchases',
            'edit purchases',
            'delete purchases',
            'manage purchase-payments',

            // Clients
            'view clients',
            'create clients',
            'edit clients',
            'delete clients',

            // Suppliers
            'view suppliers',
            'create suppliers',
            'edit suppliers',
            'delete suppliers',

            // Carriers
            'view carriers',
            'create carriers',
            'edit carriers',
            'delete carriers',

            // Partners
            'view partners',
            'create partners',
            'edit partners',
            'delete partners',

            // Products
            'view products',
            'create products',
            'edit products',
            'delete products',

            // Brands
            'view brands',
            'create brands',
            'edit brands',
            'delete brands',

            // Stock
            'view stock',
            'create stock',
            'edit stock',
            'delete stock',
            'import stock',
            'view stock-movements',

            // Cash flow / Transactions
            'view cash-flow',
            'create cash-flow',
            'edit cash-flow',
            'delete cash-flow',

            // Accounts
            'view accounts',
            'create accounts',
            'edit accounts',
            'delete accounts',
            'transfer accounts',

            // Users
            'view users',
            'create users',
            'edit users',
            'delete users',

            // Roles
            'view roles',
            'create roles',
            'edit roles',
            'delete roles',

            // Settings
            'view settings',
            'edit settings',
        ];

        foreach ($permissions as $permission) {
            Permission::findOrCreate($permission);
        }

        // --- Roles ---

        $administrator = Role::findOrCreate('Administrator');
        $administrator->syncPermissions($permissions);

        $manager = Role::findOrCreate('Manager');
        $manager->syncPermissions(array_diff($permissions, [
            'view users',
            'create users',
            'edit users',
            'delete users',
            'view roles',
            'create roles',
            'edit roles',
            'delete roles',
        ]));

        $commercial = Role::findOrCreate('Commercial');
        $commercial->syncPermissions([
            // Sales
            'view sales',
            'create sales',
            'edit sales',
            'delete sales',
            'manage sale-payments',

            // Purchases
            'view purchases',
            'create purchases',
            'edit purchases',
            'delete purchases',
            'manage purchase-payments',

            // Clients
            'view clients',
            'create clients',

            // Suppliers
            'view suppliers',
            'create suppliers',
            'edit suppliers',

            // Carriers
            'view carriers',
            'create carriers',
            'edit carriers',

            // Partners
            'view partners',
            'create partners',
            'edit partners',

            // Products
            'view products',
            'create products',
            'edit products',

            // Brands
            'view brands',
            'create brands',
            'edit brands',

            // Stock
            'view stock',
            'create stock',
            'edit stock',
            'view stock-movements',

            // Cash flow
            'view cash-flow',
            'create cash-flow',
            'edit cash-flow',
            'delete cash-flow',

            // Accounts
            'view accounts',
            'transfer accounts',

            // Users (view only)
            'view users',

            // Settings (view only)
            'view settings',
        ]);

        $driver = Role::findOrCreate('Driver');
        $driver->syncPermissions([
            'view sales',
            'view purchases',
            'view carriers',
            'view partners',
            'view brands',
            'view stock',
            'view stock-movements',
            'view suppliers',
        ]);
    }
}
