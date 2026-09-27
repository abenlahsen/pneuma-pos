import { test, expect, Page } from '@playwright/test';

/**
 * Achats — refonte 2b. La liste est groupée par fournisseur (maquette 8a) :
 * motif de ligne au lieu d'un tableau, deux barres de filtres rapides
 * (règlement, réception) et un panneau « Filtres » replié. La fiche d'achat
 * est une route (/achats/:id), la saisie un écran plein (/achats/nouveau).
 */

/** Les vraies lignes d'achat — les squelettes n'ont pas de lien. */
const purchaseRows = (page: Page) => page.locator('.list-grid-row').filter({ has: page.locator('a[href^="/achats/"]') });

/** Attend que la liste ait chargé : des lignes, ou l'état vide. */
async function waitForList(page: Page): Promise<number> {
  await expect(purchaseRows(page).first().or(page.locator('app-list-empty'))).toBeVisible({ timeout: 25_000 });
  return purchaseRows(page).count();
}

/** Déplie le panneau « Filtres ». */
async function openFilters(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Filtres' }).click();
  await expect(page.locator('.filters-section')).toBeVisible();
}

/** Attend la requête de la liste groupée qui porte ce paramètre. */
function waitForGrouped(page: Page, param: string) {
  return page.waitForResponse(r => r.url().includes('/api/purchases-grouped') && r.url().includes(param) && r.request().method() === 'GET');
}

/** Ouvre la fiche du premier achat de la liste, par l'œil de sa ligne. */
async function openFirstPurchase(page: Page): Promise<string> {
  const count = await waitForList(page);
  test.skip(count === 0, 'Aucun achat dans la liste');
  const row = purchaseRows(page).first();
  const id = (await row.locator('a[href^="/achats/"]').first().textContent())!.replace(/\D/g, '');
  await row.locator('button[title="Ouvrir"]').click();
  await expect(page).toHaveURL(new RegExp(`/achats/${id}$`));
  await expect(page.locator('.sd-title')).toHaveText(`Achat ${id}`, { timeout: 25_000 });
  return id;
}

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

  test('affiche les filtres rapides, puis Fournisseur, Statut, Paiement et dates dans « Filtres »', async ({ page }) => {
    const bar = page.locator('.filter-bar');
    await expect(bar.getByRole('button', { name: 'RESTE À PAYER' })).toBeVisible();
    await expect(bar.getByRole('button', { name: 'ATTENDUES' })).toBeVisible();
    await expect(bar.getByRole('button', { name: 'REÇUES' })).toBeVisible();

    await openFilters(page);
    const panel = page.locator('.filters-section');
    for (const label of ['Fournisseur', 'Statut', 'Du', 'Au']) {
      await expect(panel.locator('label', { hasText: new RegExp(`^${label}$`) })).toBeVisible();
    }
    await expect(panel.locator('label').filter({ hasText: /^Paiement$/ })).toBeVisible();
  });

  test('affiche les achats groupés par fournisseur, ou un état vide', async ({ page }) => {
    const count = await waitForList(page);
    if (count > 0) {
      await expect(page.locator('.pur-band').first()).toBeVisible();
      await expect(page.locator('.pur-supplier').first()).not.toBeEmpty();
    }
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

  test('l\'œil d\'une ligne ouvre la fiche d\'achat', async ({ page }) => {
    await openFirstPurchase(page);
    await expect(page.getByRole('button', { name: 'Imprimer' })).toBeVisible();
  });

  test('les flèches Précédent / Suivant naviguent entre les achats de la fiche', async ({ page }) => {
    test.slow();
    const count = await waitForList(page);
    test.skip(count < 2, 'Au moins deux achats sont nécessaires');

    const firstId = await openFirstPurchase(page);
    // La fiche hérite de l'ordre de la liste (ListContextService) : la
    // première ligne affichée n'est pas forcément la première de cet ordre,
    // on ne suppose donc rien de « Précédent » au départ.
    const prevBtn = page.locator('.sd-nav button[aria-label="Précédent"]');
    const nextBtn = page.locator('.sd-nav button[aria-label="Suivant"]');
    await expect(nextBtn).toBeEnabled();

    await nextBtn.click();
    await expect(page).not.toHaveURL(new RegExp(`/achats/${firstId}$`));
    await expect(page.locator('.sd-title')).not.toHaveText(`Achat ${firstId}`);
    await expect(prevBtn).toBeEnabled();

    await page.keyboard.press('ArrowLeft');
    await expect(page).toHaveURL(new RegExp(`/achats/${firstId}$`));
    await expect(page.locator('.sd-title')).toHaveText(`Achat ${firstId}`);
  });

  test('« Modifier » sur la fiche ouvre la saisie d\'achat', async ({ page }) => {
    const id = await openFirstPurchase(page);
    const modifier = page.locator('.sd-actions').getByRole('button', { name: 'Modifier' });
    test.skip(await modifier.count() === 0, 'Achat annulé : pas de modification');

    await modifier.click();
    await expect(page).toHaveURL(new RegExp(`/achats/${id}/modifier$`));
    await expect(page.locator('.pf-editor')).toBeVisible({ timeout: 25_000 });
  });

  test('filtrer par statut « En cours » ne garde que des achats attendus', async ({ page }) => {
    await waitForList(page);
    await openFilters(page);
    const [response] = await Promise.all([
      waitForGrouped(page, 'status=EN'),
      page.locator('.filters-section label', { hasText: /^Statut$/ }).locator('..').locator('select').selectOption({ label: 'En cours' }),
    ]);
    expect(response.ok()).toBe(true);

    const count = await waitForList(page);
    for (let i = 0; i < count; i++) {
      await expect(purchaseRows(page).nth(i).locator('.list-grid-tag', { hasText: 'ATTENDU' })).toBeVisible();
    }
  });

  test('filtrer par paiement « Non payé »', async ({ page }) => {
    await waitForList(page);
    await openFilters(page);
    const [response] = await Promise.all([
      waitForGrouped(page, 'payment_status=NON'),
      page.locator('.filters-section label').filter({ hasText: /^Paiement$/ }).locator('..').locator('select').selectOption({ label: 'Non payé' }),
    ]);
    expect(response.ok()).toBe(true);
    await waitForList(page);
  });

  test('filtrer par plage de dates', async ({ page }) => {
    await waitForList(page);
    await openFilters(page);
    const today = new Date().toISOString().split('T')[0];
    const panel = page.locator('.filters-section');

    await Promise.all([
      waitForGrouped(page, 'date_from=2025-01-01'),
      panel.locator('label', { hasText: /^Du$/ }).locator('..').locator('input[type="date"]').fill('2025-01-01'),
    ]);
    const [response] = await Promise.all([
      waitForGrouped(page, `date_to=${today}`),
      panel.locator('label', { hasText: /^Au$/ }).locator('..').locator('input[type="date"]').fill(today),
    ]);
    expect(response.ok()).toBe(true);
    await waitForList(page);
  });

  test('le bouton Imprimer ouvre la page d\'impression', async ({ page }) => {
    test.slow();
    await openFirstPurchase(page);

    await page.getByRole('button', { name: 'Imprimer' }).click();
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
