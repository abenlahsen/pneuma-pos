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
    path: 'register',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/register/register.component').then((m) => m.RegisterComponent),
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
      import('./features/suppliers/suppliers.component').then((m) => m.SuppliersComponent),
  },
  {
    path: 'carriers',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'view carriers' },
    loadComponent: () =>
      import('./features/carriers/carriers.component').then((m) => m.CarriersComponent),
  },
  {
    path: 'partners',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'view partners' },
    loadComponent: () =>
      import('./features/partners/partners.component').then((m) => m.PartnersComponent),
  },
  {
    path: 'achats',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'view purchases' },
    loadComponent: () =>
      import('./features/purchases/purchases.component').then((m) => m.PurchasesComponent),
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
