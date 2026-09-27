import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const TEST_USER_NAME  = 'USER_E2E_TEST';
const TEST_USER_EMAIL = 'e2e_user_test@pneuma.pos';
const TEST_USER_PASS  = 'Password123!';
const AUTH_FILE = path.join(__dirname, '..', '.auth', 'state.json');
const BASE_URL = process.env['E2E_BASE_URL'] ?? 'http://nginx:80';

function getStoredToken(): string | null {
  try {
    const state = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8'));
    const origin = state.origins?.find((o: { origin: string }) => o.origin === BASE_URL);
    const item = origin?.localStorage?.find((i: { name: string }) => i.name === 'auth_token');
    return item?.value ?? null;
  } catch { return null; }
}

/**
 * Utilisateurs — refonte 2b. Motif de ligne au lieu d'un tableau (nom et
 * email dans la cellule d'identité, les rôles en badges), le formulaire dans
 * la modale de référentiel 15b, la suppression dans la confirmation 15c.
 */
const SEARCH = 'Nom ou email...';

/** Les vraies lignes — les squelettes n'ont pas de nom. */
const userRows = (page: Page) => page.locator('.users-grid.list-grid-row').filter({ has: page.locator('.list-grid-name') });
const userRowByEmail = (page: Page, email: string) =>
  userRows(page).filter({ has: page.locator('.list-cell--identity .list-grid-sub', { hasText: new RegExp(`^${email.replace(/[.+]/g, '\\$&')}$`) }) });

/** Recherche un utilisateur et attend la réponse. */
async function searchUser(page: Page, text: string): Promise<void> {
  await page.getByPlaceholder(SEARCH).fill(text);
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/api/users') && r.url().includes('search=') && r.request().method() === 'GET'),
    page.getByPlaceholder(SEARCH).press('Enter'),
  ]);
}

test.describe.serial('Gestion des Utilisateurs', () => {
  let adminName = '';
  let adminEmail = '';

  test.beforeAll(async ({ request }) => {
    const token = getStoredToken();
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };

    // L'admin de la session e2e : son nom peut avoir été changé depuis le seed.
    const me = await request.get('/api/user', { headers });
    if (me.ok()) {
      const body = await me.json();
      adminName = body.user?.name ?? '';
      adminEmail = body.user?.email ?? '';
    }

    const res = await request.get(`/api/users?search=${encodeURIComponent(TEST_USER_EMAIL)}&per_page=100`, { headers });
    if (!res.ok()) return;
    const data = await res.json() as { data: { id: number; email: string }[] };
    for (const u of data.data) {
      if (u.email === TEST_USER_EMAIL) {
        await request.delete(`/api/users/${u.id}`, { headers });
      }
    }
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/users');
    await expect(page.locator('h1')).toContainText('Gestion des Utilisateurs', { timeout: 15_000 });
    await expect(userRows(page).first().or(page.locator('app-list-empty'))).toBeVisible({ timeout: 15_000 });
  });

  // ── Lecture : l'admin ─────────────────────────────────────────────────────

  test('l\'admin de la session apparaît dans la liste, avec le rôle "Administrator"', async ({ page }) => {
    test.skip(!adminEmail, 'Session e2e introuvable');
    await searchUser(page, adminEmail);
    const row = userRowByEmail(page, adminEmail);
    await expect(row).toBeVisible();
    await expect(row.locator('.list-grid-name')).toHaveText(adminName);
    await expect(row.locator('.role-badge', { hasText: 'Administrator' })).toBeVisible();
  });

  test('rechercher "Admin" filtre la liste', async ({ page }) => {
    await searchUser(page, 'Admin');
    await expect(userRows(page).first()).toBeVisible();
    const count = await userRows(page).count();
    for (let i = 0; i < count; i++) {
      await expect(userRows(page).nth(i).locator('.list-cell--identity')).toContainText(/admin/i);
    }
  });

  // ── Création ──────────────────────────────────────────────────────────────

  test('créer un utilisateur avec le rôle Commercial', async ({ page }) => {
    await page.getByRole('button', { name: 'Nouvel Utilisateur' }).click();
    const modal = page.getByRole('dialog', { name: 'Nouvel utilisateur' });
    await expect(modal).toBeVisible();

    await modal.getByPlaceholder('Nom complet').fill(TEST_USER_NAME);
    await modal.getByPlaceholder('email@example.com').fill(TEST_USER_EMAIL);
    await modal.locator('input[name="password"]').fill(TEST_USER_PASS);
    // La confirmation n'apparaît qu'une fois le mot de passe saisi.
    const confirmInput = modal.locator('input[name="password_confirmation"]');
    await expect(confirmInput).toBeVisible({ timeout: 5_000 });
    await confirmInput.fill(TEST_USER_PASS);
    await modal.locator('select[name="role"]').selectOption({ label: 'Commercial' });

    const [postResp] = await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/users') && r.request().method() === 'POST'),
      modal.getByRole('button', { name: 'Créer' }).click(),
    ]);
    expect(postResp.status()).toBeLessThan(400);
    await expect(modal).toBeHidden({ timeout: 10_000 });

    await searchUser(page, TEST_USER_EMAIL);
    await expect(userRowByEmail(page, TEST_USER_EMAIL).locator('.list-grid-name')).toHaveText(TEST_USER_NAME);
  });

  // ── Recherche ─────────────────────────────────────────────────────────────

  test('rechercher l\'utilisateur créé par email', async ({ page }) => {
    await searchUser(page, TEST_USER_EMAIL);
    const row = userRowByEmail(page, TEST_USER_EMAIL);
    await expect(row.locator('.list-grid-name')).toHaveText(TEST_USER_NAME);
    await expect(row.locator('.role-badge', { hasText: 'Commercial' })).toBeVisible();
  });

  // ── Suppression (cleanup) ─────────────────────────────────────────────────

  test('supprimer l\'utilisateur de test', async ({ page }) => {
    test.setTimeout(60_000);

    await searchUser(page, TEST_USER_EMAIL);
    await userRowByEmail(page, TEST_USER_EMAIL).locator('button[title="Supprimer"]').click();

    // Gabarit 15c : la confirmation partagée, plus de confirm() natif.
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible();
    await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/users/') && r.request().method() === 'DELETE'),
      dialog.getByRole('button', { name: 'Supprimer' }).click(),
    ]);

    await searchUser(page, TEST_USER_EMAIL);
    await expect(userRowByEmail(page, TEST_USER_EMAIL)).toHaveCount(0, { timeout: 10_000 });
  });
});
