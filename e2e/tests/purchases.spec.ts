import { test, expect } from '@playwright/test';

test.describe('Achats', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/achats');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('h1')).toContainText('Achats', { timeout: 25_000 });
  });

  test('affiche les 3 cartes de résumé', async ({ page }) => {
    await expect(page.locator('.card-label, .summary-label', { hasText: 'Total Achats' })).toBeVisible();
    await expect(page.locator('.card-label, .summary-label', { hasText: 'Total Réglé' })).toBeVisible();
    await expect(page.locator('.card-label, .summary-label', { hasText: 'Reste à Payer' })).toBeVisible();
  });

  test('affiche les filtres : Fournisseur, Statut, Paiement, dates', async ({ page }) => {
    await expect(page.locator('label:has-text("Fournisseur")')).toBeVisible();
    await expect(page.locator('label:has-text("Statut")')).toBeVisible();
    await expect(page.locator('label').filter({ hasText: /^Paiement$/ })).toBeVisible();
    await expect(page.locator('label:has-text("Du")')).toBeVisible();
    await expect(page.locator('label:has-text("Au")')).toBeVisible();
  });

  test('affiche le tableau des achats ou un état vide', async ({ page }) => {
    const table = page.locator('table');
    const emptyState = page.locator('td:has-text("Aucun achat trouvé.")');
    await expect(table.or(emptyState).first()).toBeVisible();
  });

  test('le bouton "+ Nouvel achat" est visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Nouvel achat/ })).toBeVisible();
  });

  test('ouvre la saisie d\'achat en écran plein (refonte 2b, 12b)', async ({ page }) => {
    await page.getByRole('button', { name: /Nouvel achat/ }).click();
    await expect(page).toHaveURL(/\/achats\/nouveau$/);
    await expect(page.locator('.pf-editor')).toBeVisible();
    await expect(page.getByRole('button', { name: /Enregistrer l'achat/ })).toBeVisible();
  });

  test('le bouton Visualiser ouvre la modale de détail', async ({ page }) => {
    const firstBtn = page.locator('button[title="Visualiser"]').first();
    const count = await firstBtn.count();
    test.skip(count === 0, 'Aucune ligne dans le tableau');

    await firstBtn.click();
    await expect(page.locator('.modal-overlay')).toBeVisible();
    await expect(page.locator('h2', { hasText: 'Détail de l\'achat' })).toBeVisible();
  });

  test('les flèches Précédent / Suivant naviguent entre les enregistrements dans le détail', async ({ page }) => {
    const viewButtons = page.locator('button[title="Visualiser"]');
    // The table is loaded asynchronously — wait for the first row before counting.
    await viewButtons.first().waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {});
    const count = await viewButtons.count();
    test.skip(count < 2, 'Au moins deux lignes sont nécessaires');

    await viewButtons.first().click();
    const modal = page.locator('.modal-overlay').first();
    await expect(modal).toBeVisible();

    const prevBtn = modal.locator('.modal-nav button[aria-label="Précédent"]');
    const nextBtn = modal.locator('.modal-nav button[aria-label="Suivant"]');
    const position = modal.locator('.modal-nav-pos');

    await expect(position).toHaveText(/^1 \/ \d+$/);
    const recordNumber = modal.locator('.modal-nav-id');
    await expect(recordNumber).toHaveText(/^N° \d+$/);
    const firstNumber = await recordNumber.textContent();
    await expect(prevBtn).toBeDisabled();
    await expect(nextBtn).toBeEnabled();

    await nextBtn.click();
    await expect(modal).toBeVisible();
    await expect(position).toHaveText(/^2 \/ \d+$/);
    expect(await recordNumber.textContent()).not.toBe(firstNumber);
    await expect(prevBtn).toBeEnabled();

    await page.keyboard.press('ArrowLeft');
    await expect(position).toHaveText(/^1 \/ \d+$/);
    await expect(prevBtn).toBeDisabled();

    await modal.locator('.modal-footer-actions button', { hasText: 'Fermer' }).click();
    await expect(modal).not.toBeVisible();
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
    const paymentSelect = page.locator('label').filter({ hasText: /^Paiement$/ }).locator('..').locator('select');
    await paymentSelect.selectOption({ label: 'Non payé' });
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

  test('le bouton Imprimer ouvre la page d\'impression', async ({ page }) => {
    const firstBtn = page.locator('button[title="Visualiser"]').first();
    test.skip(await firstBtn.count() === 0, 'Aucune ligne dans le tableau');

    await firstBtn.click();
    await expect(page.locator('.modal-overlay')).toBeVisible();

    await page.locator('.modal-overlay').getByRole('button', { name: /Imprimer/ }).first().click();
    // Refonte 2b, étape 10 : l'aperçu a quitté sa modale pour sa propre page.
    await expect(page).toHaveURL(/\/documents\/purchase\/\d+\/print$/);
    await expect(page.locator('.dp-sheet')).toBeVisible();
    await expect(page.getByRole('button', { name: /Télécharger PDF/ })).toBeVisible();
  });

  test('« Retour fournisseur » ouvre le volet de retour sur la fiche d\'achat (refonte 2b, 12c)', async ({ page }) => {
    // Deux navigations (liste, puis fiche) : le test a droit au triple du délai.
    test.slow();
    // Un achat reçu (seul statut qui accepte un retour), lu par l'API avec la session du navigateur.
    const id = await page.evaluate(async () => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/purchases?per_page=20&status=RECU', { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
      const rows: { id: number; status: string }[] = (await res.json()).data ?? [];
      return rows.find(r => r.status === 'RECU')?.id ?? null;
    });
    test.skip(id === null, 'Aucun achat éligible au retour');

    await page.goto(`/achats/${id}`);
    await page.getByRole('button', { name: 'Retour fournisseur' }).first().click();
    const panel = page.getByRole('dialog', { name: new RegExp(`Achat ${id}`) });
    await expect(panel).toBeVisible();
    await expect(panel.getByText("Chargement de l'achat…")).toBeHidden({ timeout: 30_000 });
    await expect(panel.locator('.pr-row:not(.pr-row--head), .pr-state').first()).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Déduire du dû' }).or(panel.locator('.pr-state')).first()).toBeVisible();
    await panel.locator('.pr-btn', { hasText: /Annuler|Fermer/ }).click();
    await expect(panel).toBeHidden();
  });
});
