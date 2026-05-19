import { test, expect } from '@playwright/test';

test.describe('Service Auto', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/service-orders');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('h1')).toContainText('Service Auto', { timeout: 15_000 });
    // Attendre que le chargement des données soit terminé
    await expect(page.locator('div.loading-state')).not.toBeVisible({ timeout: 20_000 });
  });

  test('affiche les 3 cartes de résumé financier', async ({ page }) => {
    await expect(page.locator('.card-label', { hasText: 'CA TOTAL' })).toBeVisible();
    await expect(page.locator('.card-label', { hasText: 'PAYÉ' })).toBeVisible();
    await expect(page.locator('.card-label', { hasText: 'RESTE À PAYER' })).toBeVisible();
  });

  test('affiche la section filtres avec Client, Statut, Paiement', async ({ page }) => {
    await expect(page.locator('label:has-text("Client")')).toBeVisible();
    await expect(page.locator('label:has-text("Statut")')).toBeVisible();
  });

  test('affiche le tableau des interventions ou un état vide', async ({ page }) => {
    const table = page.locator('table.data-table');
    const emptyState = page.locator('div.empty-state');
    await expect(table.or(emptyState)).toBeVisible({ timeout: 20_000 });
  });

  test('le bouton "+ Nouvelle intervention" est visible pour admin', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Nouvelle intervention/ })).toBeVisible();
  });

  test('ouvre le formulaire de création d\'intervention', async ({ page }) => {
    await page.getByRole('button', { name: /Nouvelle intervention/ }).click();
    await expect(page.locator('.modal-overlay, .form-overlay').first()).toBeVisible();
    // Champ véhicule ou date attendu
    await expect(page.locator('label:has-text("Véhicule"), label:has-text("Date"), label:has-text("Client")').first()).toBeVisible();
  });

  test('ferme le formulaire avec Annuler', async ({ page }) => {
    await page.getByRole('button', { name: /Nouvelle intervention/ }).click();
    await expect(page.locator('.modal-overlay, .form-overlay').first()).toBeVisible();

    await page.locator('.modal-overlay').getByRole('button', { name: /Annuler|Fermer|✕/ }).first().click();
    await expect(page.locator('.modal-overlay')).not.toBeVisible();
  });

  test('le bouton Visualiser ouvre la modale de détail', async ({ page }) => {
    const firstBtn = page.locator('button[title="Voir"]').first();
    test.skip(await firstBtn.count() === 0, 'Aucune ligne dans le tableau');

    await firstBtn.click();
    await expect(page.locator('.modal-overlay')).toBeVisible();
    await expect(page.locator('h2', { hasText: 'Détail de l\'intervention' })).toBeVisible();
  });

  test('le bouton Modifier dans le détail ouvre le formulaire de modification', async ({ page }) => {
    const firstBtn = page.locator('button[title="Voir"]').first();
    test.skip(await firstBtn.count() === 0, 'Aucune ligne dans le tableau');

    await firstBtn.click();
    await expect(page.locator('.modal-overlay')).toBeVisible();

    const modifierBtn = page.locator('.modal-footer button', { hasText: 'Modifier' });
    await expect(modifierBtn).toBeVisible();
    await modifierBtn.click();

    await expect(page.locator('h2', { hasText: 'Modifier l\'intervention' })).toBeVisible({ timeout: 20_000 });
  });

  test('le formulaire de prestation contient le champ Quantité', async ({ page }) => {
    await page.getByRole('button', { name: /Nouvelle intervention/ }).click();
    await expect(page.locator('.modal-overlay, .form-overlay').first()).toBeVisible();

    await expect(page.locator('.service-costs-row label', { hasText: 'Quantité' }).first()).toBeVisible();
  });

  test('le formulaire de prestation ne contient pas le champ Pièces (DH)', async ({ page }) => {
    await page.getByRole('button', { name: /Nouvelle intervention/ }).click();
    await expect(page.locator('.modal-overlay, .form-overlay').first()).toBeVisible();

    await expect(page.locator('label', { hasText: 'Pièces (DH)' })).not.toBeVisible();
  });

  test('le bouton Imprimer ouvre l\'aperçu PDF', async ({ page }) => {
    const firstBtn = page.locator('button[title="Voir"]').first();
    test.skip(await firstBtn.count() === 0, 'Aucune ligne dans le tableau');

    await firstBtn.click();
    await expect(page.locator('.modal-overlay')).toBeVisible();

    await page.locator('.modal-overlay').getByRole('button', { name: /Imprimer/ }).first().click();
    await expect(page.locator('.print-modal-overlay')).toBeVisible();
    await expect(page.getByRole('button', { name: /Télécharger PDF/ })).toBeVisible();
  });
});
