import { test, expect } from '@playwright/test';

const TEST_USER_NAME  = 'USER_E2E_TEST';
const TEST_USER_EMAIL = 'e2e_user_test@pneuma.pos';
const TEST_USER_PASS  = 'Password123!';

test.describe.serial('Gestion des Utilisateurs', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/users');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1')).toContainText('Gestion des Utilisateurs');
  });

  // ── Lecture : admin seedé ─────────────────────────────────────────────────

  test('l\'admin seedé "Admin POS" apparaît dans la liste', async ({ page }) => {
    await expect(page.locator('tbody td', { hasText: 'Admin POS' })).toBeVisible();
    await expect(page.locator('tbody td', { hasText: 'admin@pneuma.pos' })).toBeVisible();
  });

  test('l\'admin a le rôle "Administrator"', async ({ page }) => {
    const adminRow = page.locator('tbody tr', { hasText: 'admin@pneuma.pos' });
    await expect(adminRow.locator('.role-badge, td', { hasText: 'Administrator' })).toBeVisible();
  });

  test('rechercher "Admin" filtre la liste', async ({ page }) => {
    await page.fill('input[placeholder="Nom ou email..."]', 'Admin');
    await page.keyboard.press('Enter');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('tbody td', { hasText: 'Admin POS' })).toBeVisible();
  });

  // ── Création ──────────────────────────────────────────────────────────────

  test('créer un utilisateur avec le rôle Commercial', async ({ page }) => {
    await page.getByRole('button', { name: 'Nouvel Utilisateur' }).click();
    await expect(page.locator('.modal-container')).toBeVisible();
    await expect(page.locator('.modal-container h2')).toContainText('Nouvel Utilisateur');

    await page.fill('input[placeholder="Nom complet"]', TEST_USER_NAME);
    await page.fill('input[placeholder="email@example.com"]', TEST_USER_EMAIL);
    await page.fill('input[placeholder="••••••"]', TEST_USER_PASS);
    await page.fill('input[placeholder="••••••"]', TEST_USER_PASS);

    // Sélectionner le rôle Commercial
    await page.locator('.modal-container').locator('select').last().selectOption({ label: 'Commercial' });

    await page.getByRole('button', { name: 'Créer' }).click();
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.modal-overlay')).not.toBeVisible();
    await expect(page.locator('tbody td', { hasText: TEST_USER_NAME })).toBeVisible();
  });

  // ── Recherche ─────────────────────────────────────────────────────────────

  test('rechercher l\'utilisateur créé par email', async ({ page }) => {
    await page.fill('input[placeholder="Nom ou email..."]', TEST_USER_EMAIL);
    await page.keyboard.press('Enter');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('tbody td', { hasText: TEST_USER_NAME })).toBeVisible();
    await expect(page.locator('tbody td', { hasText: 'Commercial' })).toBeVisible();
  });

  // ── Suppression (cleanup) ─────────────────────────────────────────────────

  test('supprimer l\'utilisateur de test', async ({ page }) => {
    await page.fill('input[placeholder="Nom ou email..."]', TEST_USER_EMAIL);
    await page.keyboard.press('Enter');
    await page.waitForLoadState('networkidle');

    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('tbody tr', { hasText: TEST_USER_EMAIL })
      .locator('button[title="Supprimer"]')
      .click();
    await page.waitForLoadState('networkidle');

    await expect(page.locator('tbody td', { hasText: TEST_USER_NAME })).not.toBeVisible();
  });
});
