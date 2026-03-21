import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';

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
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
  },
  {
    path: 'cash-flow',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/cash-flow/cash-flow.component').then((m) => m.CashFlowComponent),
  },
  {
    path: 'sales',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/sales/sales.component').then((m) => m.SalesComponent),
  },
  {
    path: 'suppliers',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/suppliers/suppliers.component').then((m) => m.SuppliersComponent),
  },
  {
    path: 'sales-reps',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/sales-reps/sales-reps.component').then((m) => m.SalesRepsComponent),
  },
  {
    path: 'carriers',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/carriers/carriers.component').then((m) => m.CarriersComponent),
  },
  {
    path: 'partners',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/partners/partners.component').then((m) => m.PartnersComponent),
  },
  {
    path: '**',
    redirectTo: 'dashboard',
  },
];
