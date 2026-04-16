import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';
import { permissionGuard } from './core/guards/permission.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full',
  },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'change-password',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/auth/change-password/change-password.component').then((m) => m.ChangePasswordComponent),
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
  },
  {
    path: 'cash-flow',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'view cash-flow' },
    loadComponent: () =>
      import('./features/cash-flow/cash-flow.component').then((m) => m.CashFlowComponent),
  },
  {
    path: 'accounts',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'view accounts' },
    loadComponent: () =>
      import('./features/accounts/accounts.component').then((m) => m.AccountsComponent),
  },
  {
    path: 'sales',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'view sales' },
    loadComponent: () =>
      import('./features/sales/sales.component').then((m) => m.SalesComponent),
  },
  {
    path: 'suppliers',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'view suppliers' },
    loadComponent: () =>
      import('./features/suppliers/pages/suppliers-page.component').then((m) => m.SuppliersPageComponent),
  },
  {
    path: 'carriers',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'view carriers' },
    loadComponent: () =>
      import('./features/carriers/pages/carriers-page.component').then((m) => m.CarriersPageComponent),
  },
  {
    path: 'partners',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'view partners' },
    loadComponent: () =>
      import('./features/partners/pages/partners-page.component').then((m) => m.PartnersPageComponent),
  },
  {
    path: 'achats',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'view purchases' },
    loadComponent: () =>
      import('./features/purchases/purchases.component').then((m) => m.PurchasesComponent),
  },
  {
    path: 'stock',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'view stock' },
    loadComponent: () =>
      import('./features/stock/stock.component').then((m) => m.StockComponent),
  },
  {
    path: 'products',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'view products' },
    loadComponent: () =>
      import('./features/products/products.component').then((m) => m.ProductsComponent),
  },
  {
    path: 'brands',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'view brands' },
    loadComponent: () =>
      import('./features/brands/pages/brands-page.component').then((m) => m.BrandsPageComponent),
  },
  {
    path: 'roles',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'view roles' },
    loadComponent: () =>
      import('./features/roles/roles.component').then((m) => m.RolesComponent),
  },
  {
    path: 'users',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'view users' },
    loadComponent: () =>
      import('./features/users/users.component').then((m) => m.UsersComponent),
  },
  {
    path: '**',
    redirectTo: 'dashboard',
  },
];
