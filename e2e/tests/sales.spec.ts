import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

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
 * Ventes — refonte 2b. Cinq cadrans au lieu de huit, une barre de recherche
 * avec un panneau « Filtres » replié, le motif de ligne au lieu d'un tableau,
 * la saisie en écran plein (/sales/new) et la fiche en page (/sales/:id).
 */

/** Les vraies lignes de vente — les squelettes n'ont pas de bouton « Voir ». */
const saleRows = (page: Page) => page.locator('.sales-grid.list-grid-row').filter({ has: page.locator('button[title="Voir"]') });

/** Attend que la liste ait chargé : des lignes, ou l'état vide. */
async function waitForList(page: Page): Promise<number> {
  await expect(saleRows(page).first().or(page.locator('app-list-empty'))).toBeVisible({ timeout: 25_000 });
  return saleRows(page).count();
}

/** Ouvre la fiche de la première vente par son bouton « Voir ». */
async function openFirstSale(page: Page): Promise<string> {
  const count = await waitForList(page);
  test.skip(count === 0, 'Aucune vente dans la liste');
  await saleRows(page).first().locator('button[title="Voir"]').click();
  await expect(page).toHaveURL(/\/sales\/\d+$/);
  const id = page.url().match(/\/sales\/(\d+)$/)![1];
  await expect(page.locator('.sd-title')).toHaveText(`Vente ${id}`, { timeout: 25_000 });
  return id;
}

test.describe('Ventes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/sales');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('h1')).toContainText('Ventes', { timeout: 25_000 });
  });

  test('affiche les 5 cadrans de résumé', async ({ page }) => {
    await expect(page.locator('.summary-card')).toHaveCount(5);
    for (const label of [/^Pneus vendus/, /^Ventes en cours$/, /^CA /, /^Impayé$/, /^Sélection filtrée$/]) {
      await expect(page.locator('.card-label', { hasText: label })).toBeVisible();
    }
  });

  test('affiche la recherche, puis les filtres Client, Commercial et Statut dans « Filtres »', async ({ page }) => {
    await expect(page.locator('.filter-bar').getByPlaceholder('Client, produit, marque...')).toBeVisible();
    await expect(page.locator('.filters-section')).toHaveCount(0);

    await page.locator('.filter-toggle').click();
    const panel = page.locator('.filters-section');
    await expect(panel).toBeVisible();
    for (const label of ['Client', 'Commercial', 'Statut', 'Paiement', 'Du', 'Au']) {
      await expect(panel.locator('label', { hasText: new RegExp(`^${label}$`) })).toBeVisible();
    }
  });

  test('le filtre Statut accepte plusieurs statuts à la fois', async ({ page }) => {
    await waitForList(page);
    await page.locator('.filter-toggle').click();
    const pills = page.locator('.filters-section').getByRole('group', { name: 'Statut' });

    await pills.getByRole('button', { name: 'Livrée' }).click();
    const listResponse = page.waitForResponse((r) =>
      /\/api\/sales\?/.test(r.url()) && new URL(r.url()).searchParams.get('status') === 'LIVRE,MONTE');
    await pills.getByRole('button', { name: 'Montée' }).click();

    const body = await (await listResponse).json();
    for (const sale of body.data) {
      expect(['LIVRE', 'MONTE']).toContain(sale.status);
    }
    await expect(pills.getByRole('button', { name: 'Livrée' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.filter-chip', { hasText: 'Livrée' })).toBeVisible();
    await expect(page.locator('.filter-chip', { hasText: 'Montée' })).toBeVisible();
  });

  test('les filtres Paiement et Mode de paiement acceptent plusieurs valeurs', async ({ page }) => {
    await waitForList(page);
    await page.locator('.filter-toggle').click();
    const panel = page.locator('.filters-section');
    const payment = panel.getByRole('group', { name: 'Paiement', exact: true });
    const methods = panel.getByRole('group', { name: 'Mode de paiement' });

    await payment.getByRole('button', { name: 'Impayé' }).click();
    const byStatus = page.waitForResponse((r) =>
      /\/api\/sales\?/.test(r.url()) && new URL(r.url()).searchParams.get('payment_status') === 'NON PAYE,PARTIEL');
    await payment.getByRole('button', { name: 'Partiel' }).click();
    for (const sale of (await (await byStatus).json()).data) {
      expect(['NON PAYE', 'PARTIEL']).toContain(sale.payment_status);
    }
    await expect(page.locator('.filter-chip--alert', { hasText: 'Impayé' })).toBeVisible();

    await methods.getByRole('button', { name: 'Chèque' }).click();
    const byMethod = page.waitForResponse((r) =>
      /\/api\/sales\?/.test(r.url()) && new URL(r.url()).searchParams.get('payment_method') === 'Chèque,Effet');
    await methods.getByRole('button', { name: 'Effet' }).click();
    expect((await byMethod).ok()).toBe(true);
    await expect(page.locator('.filter-chip', { hasText: 'Effet' })).toBeVisible();
  });

  test('affiche les ventes ou un état vide', async ({ page }) => {
    const count = await waitForList(page);
    if (count > 0) {
      await expect(saleRows(page).first().locator('.list-grid-status')).not.toBeEmpty();
    }
  });

  test('la recherche filtre la liste', async ({ page }) => {
    const count = await waitForList(page);
    test.skip(count === 0, 'Aucune vente dans la liste');

    const client = (await saleRows(page).first().locator('.list-grid-name').textContent())!.replace(/FACTURE/, '').trim();
    await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/sales?') && r.url().includes('search=') && r.request().method() === 'GET'),
      page.locator('.filter-bar').getByPlaceholder('Client, produit, marque...').fill(client).then(() => page.keyboard.press('Enter')),
    ]);
    await expect(saleRows(page).first()).toContainText(client);
    await expect(page.locator('.filter-result-count')).toContainText(/\d+ vente\(s\)/);
  });

  test('le bouton "Nouvelle Vente" est visible pour admin', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Nouvelle Vente' })).toBeVisible();
  });

  test('« Nouvelle Vente » ouvre la saisie en écran plein', async ({ page }) => {
    await page.getByRole('link', { name: 'Nouvelle Vente' }).click();
    await expect(page).toHaveURL(/\/sales\/new$/);
    await expect(page.locator('form.sale-form-screen')).toBeVisible({ timeout: 25_000 });
    await expect(page.getByPlaceholder(/Marque, dimension \(2055516\)/)).toBeVisible();
  });

  test('« Annuler » quitte la saisie sans rien enregistrer', async ({ page }) => {
    await page.getByRole('link', { name: 'Nouvelle Vente' }).click();
    await expect(page.locator('form.sale-form-screen')).toBeVisible({ timeout: 25_000 });

    await page.locator('form.sale-form-screen').getByRole('button', { name: 'Annuler' }).click();
    await expect(page).not.toHaveURL(/\/sales\/new$/);
  });

  test('« Voir » ouvre la fiche de la vente', async ({ page }) => {
    await openFirstSale(page);
    await expect(page.locator('.sd-actions').getByRole('button', { name: 'Imprimer' })).toBeVisible();
  });

  test('les flèches Précédent / Suivant naviguent entre les ventes de la fiche', async ({ page }) => {
    test.slow();
    const count = await waitForList(page);
    test.skip(count < 2, 'Au moins deux ventes sont nécessaires');

    const firstId = await openFirstSale(page);
    // La fiche hérite de l'ordre de la liste : la première ligne affichée
    // n'est pas forcément la première de cet ordre.
    const prevBtn = page.locator('.sd-nav button[aria-label="Précédent"]');
    const nextBtn = page.locator('.sd-nav button[aria-label="Suivant"]');
    await expect(nextBtn).toBeEnabled();

    await nextBtn.click();
    await expect(page).not.toHaveURL(new RegExp(`/sales/${firstId}$`));
    await expect(page.locator('.sd-title')).not.toHaveText(`Vente ${firstId}`);
    await expect(prevBtn).toBeEnabled();

    await page.keyboard.press('ArrowLeft');
    await expect(page).toHaveURL(new RegExp(`/sales/${firstId}$`));
    await expect(page.locator('.sd-title')).toHaveText(`Vente ${firstId}`);
  });

  test('« Modifier » sur la fiche ouvre la saisie de la vente', async ({ page }) => {
    const id = await openFirstSale(page);
    const modifier = page.locator('.sd-actions').getByRole('button', { name: 'Modifier' });
    test.skip(await modifier.count() === 0, 'Vente clôturée : pas de modification');

    await modifier.click();
    await expect(page).toHaveURL(new RegExp(`/sales/${id}/edit$`));
    await expect(page.locator('form.sale-form-screen')).toBeVisible({ timeout: 25_000 });
  });

  test('le bouton Imprimer ouvre la page d\'impression', async ({ page }) => {
    test.slow();
    await openFirstSale(page);

    await page.locator('.sd-actions').getByRole('button', { name: 'Imprimer', exact: true }).click();
    // Refonte 2b, étape 10 : l'aperçu a quitté sa modale pour sa propre page.
    await expect(page).toHaveURL(/\/documents\/sale\/\d+\/print$/);
    await expect(page.locator('.dp-sheet')).toBeVisible();
    await expect(page.getByRole('button', { name: /Télécharger PDF/ })).toBeVisible();
  });
});

// Regression: commit 911d054 (21/04/2026) dropped `created_by` when sale
// creation was extracted into SaleService, and it went unnoticed for 3.5
// months because no test — unit, feature, or E2E — asserted the "Créé par"
// column actually displays a name after a sale is created. This suite
// creates a real sale via the API (mirroring what the create form submits)
// and checks the list page renders its creator.
test.describe.serial('Ventes - Créé par', () => {
  const CLIENT_NAME = 'E2E_CREATEUR_TEST';
  let createdSaleId: number | null = null;
  let createdClientId: number | null = null;
  let creatorName: string | null = null;

  test.beforeAll(async ({ request }) => {
    const token = getStoredToken();
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };

    const meRes = await request.get('/api/user', { headers });
    if (!meRes.ok()) return;
    const me = await meRes.json();
    creatorName = me.user?.name ?? null;

    const partnersRes = await request.get('/api/partners?per_page=1', { headers });
    const partners = partnersRes.ok() ? await partnersRes.json() : null;
    const partnerId = partners?.data?.[0]?.id;

    const stocksRes = await request.get('/api/stocks?per_page=50', { headers });
    const stocks = stocksRes.ok() ? await stocksRes.json() : null;
    const stockItem = (stocks?.data ?? []).find((s: { quantity: number }) => s.quantity > 0);

    if (!partnerId || !stockItem || !me.user?.id) return;

    const saleRes = await request.post('/api/sales', {
      headers,
      data: {
        date: new Date().toISOString().slice(0, 10),
        client: CLIENT_NAME,
        commercial_id: me.user.id,
        partner_id: partnerId,
        items: [{
          product_id: stockItem.product_id,
          stock_id: stockItem.id,
          quantity: 1,
          purchase_price: stockItem.purchase_price,
          selling_price: (Number(stockItem.purchase_price) || 0) + 50,
        }],
      },
    });

    if (saleRes.ok()) {
      const sale = await saleRes.json();
      createdSaleId = sale.id;
      createdClientId = sale.client_id ?? null;
    }
  });

  test.afterAll(async ({ request }) => {
    const token = getStoredToken();
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    if (createdSaleId) await request.delete(`/api/sales/${createdSaleId}`, { headers });
    if (createdClientId) await request.delete(`/api/clients/${createdClientId}`, { headers });
  });

  test('la fiche de la vente créée affiche son créateur', async ({ page, request }) => {
    test.skip(!createdSaleId || !creatorName, 'Impossible de créer une vente de test (partenaire ou stock disponible manquant)');

    // L'API d'abord : `creator` est la relation portée par created_by, vide si
    // la colonne est perdue (le défaut d'origine, côté SaleService).
    const token = getStoredToken();
    const res = await request.get(`/api/sales/${createdSaleId}`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
    expect(res.ok()).toBe(true);
    expect((await res.json()).creator?.name).toBe(creatorName);

    // Puis l'écran : la colonne « Créé par » a quitté la liste refaite ; le
    // créateur se lit sur la fiche, dans le panneau Suivi.
    await page.goto(`/sales/${createdSaleId}`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.sd-title')).toHaveText(`Vente ${createdSaleId}`, { timeout: 25_000 });
    const creator = page.locator('.sd-kv', { hasText: 'Créée par' }).locator('.sd-creator');
    await expect(creator).toHaveText(creatorName!);
  });
});
