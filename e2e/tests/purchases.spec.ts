import { test, expect } from '@playwright/test';

test.describe('Achats', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/achats');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1')).toContainText('Achats');
  });

  test('affiche les 3 cartes de résumé', async ({ page }) => {
    await expect(page.locator('.card-label, .summary-label', { hasText: 'Total Achats' })).toBeVisible();
    await expect(page.locator('.card-label, .summary-label', { hasText: 'Total Réglé' })).toBeVisible();
    await expect(page.locator('.card-label, .summary-label', { hasText: 'Reste à Payer' })).toBeVisible();
  });

  test('affiche les filtres : Fournisseur, Statut, Paiement, dates', async ({ page }) => {
    await expect(page.locator('label:has-text("Fournisseur")')).toBeVisible();
    await expect(page.locator('label:has-text("Statut")')).toBeVisible();
    await expect(page.locator('label:has-text("Paiement")')).toBeVisible();
    await expect(page.locator('label:has-text("Du")')).toBeVisible();
    await expect(page.locator('label:has-text("Au")')).toBeVisible();
  });

  test('affiche le tableau des achats ou un état vide', async ({ page }) => {
    const table = page.locator('table');
    const emptyState = page.locator('td:has-text("Aucun achat trouvé.")');
    await expect(table.or(emptyState)).toBeVisible();
  });

  test('le bouton "+ Nouvel achat" est visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Nouvel achat/ })).toBeVisible();
  });

  test('ouvre le formulaire de création d\'achat', async ({ page }) => {
    await page.getByRole('button', { name: /Nouvel achat/ }).click();
    await expect(page.locator('.modal-overlay, .form-overlay').first()).toBeVisible();
    await expect(page.locator('label:has-text("Fournisseur"), label:has-text("Date")').first()).toBeVisible();
  });

  test('le bouton Visualiser ouvre la modale de détail', async ({ page }) => {
    const firstBtn = page.locator('button[title="Visualiser"]').first();
    const count = await firstBtn.count();
    test.skip(count === 0, 'Aucune ligne dans le tableau');

    await firstBtn.click();
    await expect(page.locator('.modal-overlay')).toBeVisible();
    await expect(page.locator('h2', { hasText: 'Détail de l\'achat' })).toBeVisible();
  });

  test('le bouton Modifier dans le détail ouvre le formulaire de modification', async ({ page }) => {
    const firstBtn = page.locator('button[title="Visualiser"]').first();
    test.skip(await firstBtn.count() === 0, 'Aucune ligne dans le tableau');

    await firstBtn.click();
    await expect(page.locator('.modal-overlay')).toBeVisible();

    const modifierBtn = page.locator('.modal-footer button', { hasText: 'Modifier' });
    await expect(modifierBtn).toBeVisible();
    await modifierBtn.click();

    await expect(page.locator('h2', { hasText: 'Modifier Achat' })).toBeVisible();
  });

  test('filtrer par statut "En cours"', async ({ page }) => {
    const statusSelect = page.locator('label:has-text("Statut")').locator('..').locator('select');
    await statusSelect.selectOption({ label: 'En cours' });
    await page.waitForLoadState('networkidle');
    // Vérifier que la page ne crashe pas et reste cohérente
    await expect(page.locator('h1')).toContainText('Achats');
  });

  test('filtrer par paiement "Non payé"', async ({ page }) => {
    const paymentSelect = page.locator('label:has-text("Paiement")').locator('..').locator('select');
    await paymentSelect.selectOption({ label: /Non payé/i });
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1')).toContainText('Achats');
  });

  test('filtrer par plage de dates', async ({ page }) => {
    // Du 01/01/2025 au aujourd'hui
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    await page.fill('input[type="date"]:first-of-type', '2025-01-01');
    await page.fill('input[type="date"]:last-of-type', today);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1')).toContainText('Achats');
  });
});
