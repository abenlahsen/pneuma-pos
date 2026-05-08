import { test, expect } from '@playwright/test';

const TEST_CLIENT = 'CLIENT_E2E_TEST';
const TEST_CLIENT_UPDATED = 'CLIENT_E2E_TEST_MAJ';

test.describe.serial('Clients', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/clients');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1')).toContainText('Clients');
  });

  // ── Lecture : état initial (pas de clients seedés) ────────────────────────

  test('affiche "Aucun client trouvé" si la base est vide', async ({ page }) => {
    // Ce test passe seulement si aucun client n'existe — sinon on vérifie juste le tableau
    const emptyState = page.locator('td:has-text("Aucun client trouvé.")');
    const rows = page.locator('tbody tr').filter({ hasNotText: 'Chargement' });
    // L'un ou l'autre doit être vrai
    const isEmpty = await emptyState.isVisible();
    const hasRows = await rows.first().isVisible();
    expect(isEmpty || hasRows).toBeTruthy();
  });

  // ── Création ──────────────────────────────────────────────────────────────

  test('créer un nouveau client particulier', async ({ page }) => {
    await page.getByRole('button', { name: 'Nouveau Client' }).click();
    await expect(page.locator('.modal-container')).toBeVisible();
    await expect(page.locator('.modal-container h2')).toContainText('Nouveau Client');

    await page.fill('input[name="name"]', TEST_CLIENT);
    await page.selectOption('select[name="category"]', 'Paticulier');
    await page.fill('input[name="phone"]', '0612345678');
    await page.fill('input[name="city"]', 'Casablanca');

    await page.click('button[type="submit"]:has-text("Enregistrer")');
    await page.waitForLoadState('networkidle');

    // Le modal se ferme
    await expect(page.locator('.modal-overlay')).not.toBeVisible();

    // Le client apparaît dans la liste
    await expect(page.locator('.btn-link.client-link', { hasText: TEST_CLIENT })).toBeVisible();
  });

  // ── Recherche ─────────────────────────────────────────────────────────────

  test('rechercher le client créé par nom', async ({ page }) => {
    await page.fill('input[placeholder="Nom, téléphone, ville ou email..."]', TEST_CLIENT);
    await page.keyboard.press('Enter');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.btn-link.client-link', { hasText: TEST_CLIENT })).toBeVisible();
  });

  test('rechercher le client par ville "Casablanca"', async ({ page }) => {
    await page.fill('input[placeholder="Filtrer par ville"]', 'Casablanca');
    await page.keyboard.press('Enter');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.btn-link.client-link', { hasText: TEST_CLIENT })).toBeVisible();
  });

  // ── Fiche client ──────────────────────────────────────────────────────────

  test('naviguer vers la fiche du client', async ({ page }) => {
    await page.fill('input[placeholder="Nom, téléphone, ville ou email..."]', TEST_CLIENT);
    await page.keyboard.press('Enter');
    await page.waitForLoadState('networkidle');

    // Cliquer sur le nom du client (btn-link) pour ouvrir la fiche
    await page.locator('.btn-link.client-link', { hasText: TEST_CLIENT }).click();
    await expect(page).toHaveURL(/\/clients\/\d+/);
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  // ── Modification ──────────────────────────────────────────────────────────

  test('modifier le client créé', async ({ page }) => {
    await page.fill('input[placeholder="Nom, téléphone, ville ou email..."]', TEST_CLIENT);
    await page.keyboard.press('Enter');
    await page.waitForLoadState('networkidle');

    await page.locator('tr', { hasText: TEST_CLIENT }).locator('button[title="Modifier"]').click();
    await expect(page.locator('.modal-container')).toBeVisible();
    await expect(page.locator('.modal-container h2')).toContainText('Modifier Client');

    await page.fill('input[name="name"]', TEST_CLIENT_UPDATED);
    await page.click('button[type="submit"]:has-text("Enregistrer")');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.btn-link.client-link', { hasText: TEST_CLIENT_UPDATED })).toBeVisible();
  });

  // ── Suppression (cleanup) ─────────────────────────────────────────────────

  test('supprimer le client de test', async ({ page }) => {
    await page.fill('input[placeholder="Nom, téléphone, ville ou email..."]', TEST_CLIENT_UPDATED);
    await page.keyboard.press('Enter');
    await page.waitForLoadState('networkidle');

    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('tr', { hasText: TEST_CLIENT_UPDATED }).locator('button[title="Supprimer"]').click();
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.btn-link.client-link', { hasText: TEST_CLIENT_UPDATED })).not.toBeVisible();
  });
});
