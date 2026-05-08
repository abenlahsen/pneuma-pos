import { test, expect } from '@playwright/test';

const SEEDED_ROLES = ['Administrator', 'Manager', 'Commercial', 'Driver'];
const TEST_ROLE = 'ROLE_E2E_TEST';

test.describe.serial('Gestion des Rôles', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/roles');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1')).toContainText('Gestion des Rôles');
  });

  // ── Lecture : rôles seedés ────────────────────────────────────────────────

  test('affiche les 4 rôles seedés', async ({ page }) => {
    for (const role of SEEDED_ROLES) {
      await expect(page.locator('tbody td', { hasText: role }).first()).toBeVisible();
    }
  });

  test('le rôle Administrator a des permissions (non vide)', async ({ page }) => {
    const adminRow = page.locator('tbody tr', { hasText: 'Administrator' });
    // La colonne Permissions ne doit pas être vide
    const permissionsCell = adminRow.locator('td').nth(1);
    await expect(permissionsCell).not.toBeEmpty();
  });

  test('affiche les boutons "Nouveau Rôle" et "Nouvelle Permission"', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Nouveau Rôle' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nouvelle Permission' })).toBeVisible();
  });

  // ── Détail d\'un rôle ──────────────────────────────────────────────────────

  test('ouvrir le détail du rôle Commercial affiche ses permissions', async ({ page }) => {
    // Cliquer sur le nom ou le bouton Voir du rôle Commercial
    await page.locator('tbody tr', { hasText: 'Commercial' })
      .locator('button[title="Modifier"], button[title="Voir"], .btn-icon')
      .first()
      .click();
    await expect(page.locator('.modal-container, .permissions-panel').first()).toBeVisible();
  });

  // ── Création ──────────────────────────────────────────────────────────────

  test('créer un nouveau rôle', async ({ page }) => {
    await page.getByRole('button', { name: 'Nouveau Rôle' }).click();
    await expect(page.locator('.modal-container')).toBeVisible();
    await expect(page.locator('.modal-container h2')).toContainText('Nouveau Rôle');

    await page.fill('input[placeholder="Ex: Manager"]', TEST_ROLE);
    await page.getByRole('button', { name: 'Créer' }).click();
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.modal-overlay')).not.toBeVisible();
    await expect(page.locator('tbody td', { hasText: TEST_ROLE })).toBeVisible();
  });

  // ── Suppression (cleanup) ─────────────────────────────────────────────────

  test('supprimer le rôle de test', async ({ page }) => {
    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('tbody tr', { hasText: TEST_ROLE })
      .locator('button[title="Supprimer"]')
      .click();
    await page.waitForLoadState('networkidle');

    await expect(page.locator('tbody td', { hasText: TEST_ROLE })).not.toBeVisible();
  });
});
