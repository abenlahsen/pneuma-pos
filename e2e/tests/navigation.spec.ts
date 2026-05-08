import { test, expect } from '@playwright/test';

const ROUTES = [
  { path: '/sales',           titre: 'Ventes' },
  { path: '/service-orders',  titre: 'Service Auto' },
  { path: '/achats',          titre: 'Achats' },
  { path: '/clients',         titre: 'Clients' },
  { path: '/stock',           titre: 'Stock' },
  { path: '/products',        titre: 'Produits' },
  { path: '/brands',          titre: 'Marques' },
  { path: '/users',           titre: 'Gestion des Utilisateurs' },
  { path: '/roles',           titre: 'Gestion des Rôles' },
  { path: '/settings',        titre: 'Paramètres' },
  { path: '/accounts',        titre: 'Comptes' },
];

test.describe('Navigation', () => {
  test('la page dashboard charge sans erreur', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page).not.toHaveURL(/\/login/);
    // Pas d'erreur JS critique
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.waitForLoadState('networkidle');
    expect(errors.filter((e) => e.includes('ERROR'))).toHaveLength(0);
  });

  for (const route of ROUTES) {
    test(`${route.path} — charge avec le titre "${route.titre}"`, async ({ page }) => {
      await page.goto(route.path);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('h1').first()).toContainText(route.titre, { timeout: 8_000 });
    });
  }

  test('une route inconnue redirige vers /dashboard', async ({ page }) => {
    await page.goto('/page-inexistante-xyz');
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('l\'URL racine redirige vers /dashboard', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
