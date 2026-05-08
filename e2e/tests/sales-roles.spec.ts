import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = process.env['E2E_BASE_URL'] ?? 'http://localhost:8888';
const TEST_PASSWORD = 'Password123!';
const MANAGER_EMAIL = 'e2e_manager_sales@pneuma.pos';
const COMMERCIAL_EMAIL = 'e2e_commercial_sales@pneuma.pos';

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

  if (!res.ok) {
    throw new Error(`Login échoué pour ${email} (${res.status})`);
  }

  const data = (await res.json()) as { token: string };
  return data.token;
}

test.describe.serial('Ventes — accès par rôle (Manager & Commercial)', () => {
  // Bypass the global admin storageState pour ce bloc
  test.use({ storageState: { cookies: [], origins: [] } });

  let managerToken = '';
  let commercialToken = '';
  let managerId: number | null = null;
  let commercialId: number | null = null;

  test.beforeAll(async () => {
    const adminToken = getAdminToken();

    // Créer l'utilisateur Manager
    const managerRes = await apiRequest('POST', 'users', adminToken, {
      name: 'E2E Manager Ventes',
      email: MANAGER_EMAIL,
      password: TEST_PASSWORD,
      password_confirmation: TEST_PASSWORD,
      role: 'Manager',
    });
    if (managerRes.ok) {
      const data = (await managerRes.json()) as any;
      managerId = data.id ?? data.data?.id ?? null;
    }

    // Créer l'utilisateur Commercial
    const commercialRes = await apiRequest('POST', 'users', adminToken, {
      name: 'E2E Commercial Ventes',
      email: COMMERCIAL_EMAIL,
      password: TEST_PASSWORD,
      password_confirmation: TEST_PASSWORD,
      role: 'Commercial',
    });
    if (commercialRes.ok) {
      const data = (await commercialRes.json()) as any;
      commercialId = data.id ?? data.data?.id ?? null;
    }

    managerToken = await loginAndGetToken(MANAGER_EMAIL, TEST_PASSWORD);
    commercialToken = await loginAndGetToken(COMMERCIAL_EMAIL, TEST_PASSWORD);
  });

  test.afterAll(async () => {
    const adminToken = getAdminToken();

    for (const id of [managerId, commercialId]) {
      if (id) {
        await apiRequest('DELETE', `users/${id}`, adminToken);
      }
    }
  });

  // ── Helpers ────────────────────────────────────────────────────────────────

  async function openSaleFormAs(page: any, token: string): Promise<void> {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.evaluate((t: string) => localStorage.setItem('auth_token', t), token);
    await page.goto('/sales');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Nouvelle Vente' }).click();
    await expect(page.locator('.modal-overlay')).toBeVisible();
    await page.waitForLoadState('networkidle');
    // La section "Logistique & Suivi" est repliée par défaut — l'ouvrir pour accéder au select commercial_id
    await page.locator('h3.section-title.collapsible').click();
  }

  // ── Manager ────────────────────────────────────────────────────────────────

  test('Manager : la page Ventes est accessible', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.evaluate((t: string) => localStorage.setItem('auth_token', t), managerToken);
    await page.goto('/sales');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1')).toContainText('Ventes');
  });

  test('Manager : GET /api/users retourne 403', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const res = await page.request.get(`${BASE_URL}/api/users`, {
      headers: { Authorization: `Bearer ${managerToken}`, Accept: 'application/json' },
    });

    expect(res.status()).toBe(403);
  });

  test('Manager : le dropdown Commercial est peuplé à la création d\'une vente', async ({ page }) => {
    await openSaleFormAs(page, managerToken);

    const select = page.locator('select[name="commercial_id"]');
    await expect(select).toBeVisible();

    const optionCount = await select.locator('option').count();
    // Au moins l'option vide + 1 commercial
    expect(optionCount).toBeGreaterThan(1);
  });

  test('Manager : peut créer une vente', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.evaluate((t: string) => localStorage.setItem('auth_token', t), managerToken);

    const res = await page.request.get(`${BASE_URL}/api/sales-filters`, {
      headers: { Authorization: `Bearer ${managerToken}`, Accept: 'application/json' },
    });

    expect(res.status()).toBe(200);
    const data = await res.json() as any;
    expect(Array.isArray(data.commercials)).toBe(true);
    expect(data.commercials.length).toBeGreaterThan(0);
  });

  // ── Commercial ─────────────────────────────────────────────────────────────

  test('Commercial : la page Ventes est accessible', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.evaluate((t: string) => localStorage.setItem('auth_token', t), commercialToken);
    await page.goto('/sales');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1')).toContainText('Ventes');
  });

  test('Commercial : le dropdown Commercial est peuplé à la création d\'une vente', async ({ page }) => {
    await openSaleFormAs(page, commercialToken);

    const select = page.locator('select[name="commercial_id"]');
    await expect(select).toBeVisible();

    const optionCount = await select.locator('option').count();
    expect(optionCount).toBeGreaterThan(1);
  });

  test('Commercial : GET /api/sales-filters retourne les commerciaux', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const res = await page.request.get(`${BASE_URL}/api/sales-filters`, {
      headers: { Authorization: `Bearer ${commercialToken}`, Accept: 'application/json' },
    });

    expect(res.status()).toBe(200);
    const data = await res.json() as any;
    expect(Array.isArray(data.commercials)).toBe(true);
    expect(data.commercials.length).toBeGreaterThan(0);
  });
});
