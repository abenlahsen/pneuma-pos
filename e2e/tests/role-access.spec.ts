import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = process.env['E2E_BASE_URL'] ?? 'http://localhost:8888';
const TEST_PASSWORD = 'Password123!';
const MANAGER_EMAIL = 'e2e_manager_access@pneuma.pos';
const COMMERCIAL_EMAIL = 'e2e_commercial_access@pneuma.pos';

// ── Helpers ───────────────────────────────────────────────────────────────────

function getAdminToken(): string {
  const authFile = path.join(__dirname, '..', '.auth', 'state.json');
  const state = JSON.parse(fs.readFileSync(authFile, 'utf-8'));
  return state.origins[0].localStorage.find((i: any) => i.name === 'auth_token').value;
}

async function apiRequest(
  method: string,
  endpoint: string,
  token: string,
  body?: object,
): Promise<Response> {
  return fetch(`${BASE_URL}/api/${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function loginAndGetToken(email: string, password: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`Login échoué pour ${email} (${res.status})`);
  const data = (await res.json()) as { token: string };
  return data.token;
}

async function navigateAs(page: any, token: string, route: string): Promise<void> {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.evaluate((t: string) => localStorage.setItem('auth_token', t), token);
  await page.goto(route);
  await page.waitForLoadState('networkidle');
}

// ── Suite ─────────────────────────────────────────────────────────────────────

test.describe.serial('Accès par rôle — Manager & Commercial', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  let managerToken = '';
  let commercialToken = '';
  let managerId: number | null = null;
  let commercialId: number | null = null;

  test.beforeAll(async () => {
    test.setTimeout(90_000);
    const adminToken = getAdminToken();

    const managerRes = await apiRequest('POST', 'users', adminToken, {
      name: 'E2E Manager Accès',
      email: MANAGER_EMAIL,
      password: TEST_PASSWORD,
      password_confirmation: TEST_PASSWORD,
      role: 'Manager',
    });
    if (managerRes.ok) {
      const data = (await managerRes.json()) as any;
      managerId = data.id ?? null;
    }

    const commercialRes = await apiRequest('POST', 'users', adminToken, {
      name: 'E2E Commercial Accès',
      email: COMMERCIAL_EMAIL,
      password: TEST_PASSWORD,
      password_confirmation: TEST_PASSWORD,
      role: 'Commercial',
    });
    if (commercialRes.ok) {
      const data = (await commercialRes.json()) as any;
      commercialId = data.id ?? null;
    }

    managerToken = await loginAndGetToken(MANAGER_EMAIL, TEST_PASSWORD);
    commercialToken = await loginAndGetToken(COMMERCIAL_EMAIL, TEST_PASSWORD);
  });

  test.afterAll(async () => {
    const adminToken = getAdminToken();
    for (const id of [managerId, commercialId]) {
      if (id) await apiRequest('DELETE', `users/${id}`, adminToken);
    }
  });

  // ── 1. Routes protégées — Manager ─────────────────────────────────────────

  test('Manager : /users redirige vers /dashboard', async ({ page }) => {
    await navigateAs(page, managerToken, '/users');
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('Manager : /roles redirige vers /dashboard', async ({ page }) => {
    await navigateAs(page, managerToken, '/roles');
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('Manager : /sales est accessible', async ({ page }) => {
    await navigateAs(page, managerToken, '/sales');
    await expect(page.locator('h1')).toContainText('Ventes');
  });

  test('Manager : /achats est accessible', async ({ page }) => {
    await navigateAs(page, managerToken, '/achats');
    await expect(page.locator('h1')).toBeVisible();
  });

  test('Manager : /stock est accessible', async ({ page }) => {
    await navigateAs(page, managerToken, '/stock');
    await expect(page.locator('h1')).toBeVisible();
  });

  // ── 2. Routes protégées — Commercial ──────────────────────────────────────

  test('Commercial : /roles redirige vers /dashboard', async ({ page }) => {
    await navigateAs(page, commercialToken, '/roles');
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('Commercial : /users est accessible (a view users)', async ({ page }) => {
    await navigateAs(page, commercialToken, '/users');
    await expect(page.locator('h1')).toContainText('Gestion des Utilisateurs');
  });

  test('Commercial : /sales est accessible', async ({ page }) => {
    await navigateAs(page, commercialToken, '/sales');
    await expect(page.locator('h1')).toContainText('Ventes');
  });

  // ── 3. Dashboard — section KPI ────────────────────────────────────────────

  test('Manager : la section KPI est absente sur le dashboard', async ({ page }) => {
    await navigateAs(page, managerToken, '/dashboard');
    await expect(page.locator('.kpi-dashboard')).not.toBeVisible();
  });

  test('Commercial : la section KPI est absente sur le dashboard', async ({ page }) => {
    await navigateAs(page, commercialToken, '/dashboard');
    await expect(page.locator('.kpi-dashboard')).not.toBeVisible();
  });

  // ── 4. Navigation selon le rôle ───────────────────────────────────────────
  // Refonte 2b : les raccourcis du tableau de bord ont disparu. Le rail porte
  // les écrans de travail ; Utilisateurs et Rôles sont passés dans la liste
  // de gauche des Paramètres (17a). Chacun n'apparaît qu'avec sa permission.

  test('Manager : Utilisateurs et Rôles sont absents des Paramètres', async ({ page }) => {
    await navigateAs(page, managerToken, '/settings');
    await expect(page.locator('.st-nav .st-entry').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.st-nav a[href="/users"]')).not.toBeAttached();
    await expect(page.locator('.st-nav a[href="/roles"]')).not.toBeAttached();
  });

  test('Manager : Ventes est dans le rail', async ({ page }) => {
    await navigateAs(page, managerToken, '/dashboard');
    await expect(page.locator('.rail a.rail-item[href="/sales"]')).toBeVisible();
  });

  test('Commercial : Utilisateurs est dans les Paramètres', async ({ page }) => {
    await navigateAs(page, commercialToken, '/settings');
    await expect(page.locator('.st-nav a[href="/users"]')).toBeVisible({ timeout: 15_000 });
  });

  test('Commercial : Rôles est absent des Paramètres', async ({ page }) => {
    await navigateAs(page, commercialToken, '/settings');
    await expect(page.locator('.st-nav .st-entry').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.st-nav a[href="/roles"]')).not.toBeAttached();
  });

  // ── 5. Marques — boutons d'action selon le rôle ───────────────────────────

  test('Manager : les boutons Modifier et Supprimer sont visibles sur /brands', async ({ page }) => {
    await navigateAs(page, managerToken, '/brands');

    // Refonte 2b : motif de ligne ; Supprimer est dans le menu ⋯ (gabarit 14a).
    const rows = page.locator('.brands-grid.list-grid-row').filter({ has: page.locator('.list-grid-name') });
    await expect(rows.first().or(page.locator('app-list-empty'))).toBeVisible({ timeout: 15_000 });
    test.skip(await rows.count() === 0, 'Aucune marque en base — test ignoré');

    await expect(rows.first().locator('button[title="Modifier"]')).toBeVisible({ timeout: 12_000 });
    // Le menu ⋯ n'existe que sous le seuil de réduction ; au-dessus, ses actions sont en ligne.
    const more = rows.first().getByRole('button', { name: 'Autres actions' });
    if (await more.isVisible()) await more.click();
    await expect(rows.first().locator('button[title="Supprimer"]')).toBeVisible();
  });

  test('Commercial : le bouton Supprimer est absent sur /brands (pas de delete brands)', async ({ page }) => {
    await navigateAs(page, commercialToken, '/brands');

    const rows = page.locator('.brands-grid.list-grid-row').filter({ has: page.locator('.list-grid-name') });
    await expect(rows.first().or(page.locator('app-list-empty'))).toBeVisible({ timeout: 15_000 });
    test.skip(await rows.count() === 0, 'Aucune marque en base — test ignoré');

    await expect(rows.first().locator('button[title="Modifier"]')).toBeVisible({ timeout: 12_000 });
    await expect(rows.first().locator('button[title="Supprimer"]')).not.toBeAttached();
  });
});
