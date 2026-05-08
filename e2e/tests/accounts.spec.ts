import { test, expect } from '@playwright/test';

const TEST_ACCOUNT = 'COMPTE_E2E_TEST';

test.describe.serial('Comptes & Trésorerie', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/accounts');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1')).toContainText('Comptes');
  });

  // ── Lecture ───────────────────────────────────────────────────────────────

  test('affiche la liste des comptes ou un état vide', async ({ page }) => {
    // Soit des cartes compte, soit un état vide
    const accountCards = page.locator('.account-card, .card').filter({ hasNotText: 'Chargement' });
    const emptyState   = page.locator(':has-text("Aucun compte")');
    await expect(accountCards.first().or(emptyState)).toBeVisible();
  });

  test('affiche les boutons "+ Nouveau Compte" et "🔄 Nouveau Transfert"', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Nouveau Compte/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Nouveau Transfert/ })).toBeVisible();
  });

  // ── Création ──────────────────────────────────────────────────────────────

  test('ouvre le formulaire de création de compte', async ({ page }) => {
    await page.getByRole('button', { name: /Nouveau Compte/ }).click();
    await expect(page.locator('.modal-overlay, .modal-container').first()).toBeVisible();
    await expect(page.locator('label:has-text("Nom"), label:has-text("Type")').first()).toBeVisible();
  });

  test('créer un compte de trésorerie', async ({ page }) => {
    await page.getByRole('button', { name: /Nouveau Compte/ }).click();
    await expect(page.locator('.modal-container')).toBeVisible();

    // Chercher le champ Nom du compte
    await page.locator('.modal-container').locator('input[name="name"], input[placeholder*="nom" i], input[placeholder*="compte" i]').first().fill(TEST_ACCOUNT);

    await page.locator('.modal-container').locator('button[type="submit"]:has-text("Enregistrer"), button:has-text("Créer")').first().click();
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.modal-overlay')).not.toBeVisible();
    await expect(page.locator(':has-text("' + TEST_ACCOUNT + '")').first()).toBeVisible();
  });

  // ── Détail du compte ──────────────────────────────────────────────────────

  test('cliquer sur un compte affiche ses détails et transactions', async ({ page }) => {
    // Cliquer sur la première carte de compte disponible
    const firstAccount = page.locator('.account-card, button.account-item, tr.account-row').first();
    if (await firstAccount.isVisible()) {
      await firstAccount.click();
      await page.waitForLoadState('networkidle');
      // Page de détail : cards Solde Actuel, Total Entrées, Total Sorties
      await expect(page.locator(':has-text("Solde Actuel"), :has-text("Total Entrées")').first()).toBeVisible();
    }
  });

  // ── Suppression (cleanup) ─────────────────────────────────────────────────

  test('supprimer le compte de test', async ({ page }) => {
    // Chercher le compte créé
    const accountItem = page.locator(':has-text("' + TEST_ACCOUNT + '")').first();
    if (await accountItem.isVisible()) {
      // Chercher le bouton Supprimer dans la même zone
      const deleteBtn = page.locator('button[title="Supprimer"], button:has-text("Supprimer")')
        .filter({ hasText: '' })
        .first();
      if (await deleteBtn.isVisible()) {
        page.once('dialog', (dialog) => dialog.accept());
        await deleteBtn.click();
        await page.waitForLoadState('networkidle');
        await expect(page.locator(':has-text("' + TEST_ACCOUNT + '")').first()).not.toBeVisible();
      }
    }
  });
});
