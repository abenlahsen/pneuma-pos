import { test, expect } from '@playwright/test';

test.describe('Service Auto', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/service-orders');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('h1')).toContainText('Service Auto', { timeout: 15_000 });
    // Attendre que le chargement des données soit terminé
    await expect(page.locator('div.loading-state')).not.toBeVisible({ timeout: 20_000 });
  });

  test('affiche les cartes de résumé financier', async ({ page }) => {
    await expect(page.locator('.card-label', { hasText: /CA du mois/i })).toBeVisible();
    await expect(page.locator('.card-label', { hasText: /Marge brute/i })).toBeVisible();
    await expect(page.locator('.card-label', { hasText: /Encaissé/i })).toBeVisible();
  });

  // Refonte 2b, étape 11 : le panneau de filtres est devenu la barre du mixin.
  test('affiche la barre de filtres avec Client, Statut, Paiement', async ({ page }) => {
    await page.getByRole('button', { name: 'Liste' }).click();
    const bar = page.locator('.filter-bar');
    await expect(bar.getByRole('combobox', { name: 'Fiche client' })).toBeVisible();
    const statuses = bar.getByRole('group', { name: 'Statut' });
    for (const label of ['En cours', 'Terminée', 'Annulée']) {
      await expect(statuses.getByRole('button', { name: label })).toHaveAttribute('aria-pressed', 'false');
    }
    await expect(bar.getByRole('group', { name: 'Paiement', exact: true }).getByRole('button', { name: 'Impayé' })).toBeVisible();
    // « Effet » manquait à la liste codée en dur : elle vient maintenant des constantes communes.
    await expect(bar.getByRole('group', { name: 'Mode de paiement' }).getByRole('button', { name: 'Effet' })).toBeVisible();
  });

  // Refonte 2b, étape 11 : la vue Liste est passée au motif de ligne.
  test('affiche la liste des interventions ou un état vide', async ({ page }) => {
    await page.getByRole('button', { name: 'Liste' }).click();
    const rows = page.locator('.list-grid-row.so-grid:not([appskeletonrow])');
    const empty = page.locator('app-list-empty');
    await expect(rows.or(empty).first()).toBeVisible({ timeout: 20_000 });
  });

  test('le bouton "+ Nouvelle intervention" est visible pour admin', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Nouvelle intervention/ })).toBeVisible();
  });

  // Refonte 2b, 12a : la fiche et le formulaire ne sont plus des modales.
  // L'intervention s'ouvre sur son écran, /service-auto/nouveau et /service-auto/:id.

  test('« Nouvelle intervention » ouvre l\'écran de saisie', async ({ page }) => {
    await page.getByRole('button', { name: /Nouvelle intervention/ }).click();
    await expect(page).toHaveURL(/\/service-auto\/nouveau$/);
    await expect(page.locator('.so-editor')).toBeVisible();
    await expect(page.getByRole('button', { name: /\+ Prestation/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Enregistrer l'intervention/ })).toBeDisabled();
  });

  test('« Atelier » ramène à la liste sans rien enregistrer', async ({ page }) => {
    await page.getByRole('button', { name: /Nouvelle intervention/ }).click();
    await expect(page.locator('.so-editor')).toBeVisible();
    await page.getByRole('button', { name: /Atelier/ }).first().click();
    await expect(page).toHaveURL(/\/service-orders$/);
  });

  test('une prestation s\'ajoute par la ligne d\'ajout, et la grille est unique', async ({ page }) => {
    await page.getByRole('button', { name: /Nouvelle intervention/ }).click();
    await expect(page.locator('.so-editor')).toBeVisible();

    const add = page.getByPlaceholder(/Ajouter une prestation/);
    await add.fill('Contrôle climatisation');
    await add.press('Enter');

    await expect(page.locator('.so-line').filter({ hasText: 'Prestation' }).first()).toBeVisible();
    // Plus de libellé qui change selon le type de ligne.
    await expect(page.locator('label', { hasText: 'Pièces (DH)' })).not.toBeVisible();
    await expect(page.locator('.so-grid-head')).toContainText('Coût DH');
  });

  test('« Voir » ouvre l\'écran de l\'intervention', async ({ page }) => {
    await page.getByRole('button', { name: 'Liste' }).click();
    await expect(page.locator('.list-grid-row.so-grid:not([appskeletonrow])').or(page.locator('app-list-empty')).first())
      .toBeVisible({ timeout: 20_000 });
    const firstBtn = page.locator('button[title="Voir"]').first();
    test.skip(await firstBtn.count() === 0, 'Aucune ligne dans le tableau');

    await firstBtn.click();
    await expect(page).toHaveURL(/\/service-auto\/\d+$/);
    await expect(page.locator('.so-steps')).toBeVisible();
  });

  test('le bouton Imprimer ouvre la page d\'impression', async ({ page }) => {
    await page.getByRole('button', { name: 'Liste' }).click();
    await expect(page.locator('.list-grid-row.so-grid:not([appskeletonrow])').or(page.locator('app-list-empty')).first())
      .toBeVisible({ timeout: 20_000 });
    const firstBtn = page.locator('button[title="Voir"]').first();
    test.skip(await firstBtn.count() === 0, 'Aucune ligne dans le tableau');

    await firstBtn.click();
    await expect(page.locator('.so-editor')).toBeVisible();

    await page.locator('.so-bar').getByRole('button', { name: /Imprimer/ }).click();
    // Refonte 2b, étape 10 : l'aperçu a quitté sa modale pour sa propre page.
    await expect(page).toHaveURL(/\/documents\/service_order\/\d+\/print$/);
    await expect(page.locator('.dp-sheet')).toBeVisible();
    await expect(page.getByRole('button', { name: /Télécharger PDF/ })).toBeVisible();
  });
});
