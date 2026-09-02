import { test, expect } from '@playwright/test';
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

test.describe('Ventes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/sales');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1')).toContainText('Ventes');
  });

  test('affiche les 8 cartes de résumé', async ({ page }) => {
    const cards = page.locator('.summary-card');
    await expect(cards).toHaveCount(8);
    await expect(page.locator('.card-label', { hasText: 'Pneus vendus aujourd\'hui' })).toBeVisible();
    await expect(page.locator('.card-label', { hasText: 'Pneus vendus ce mois' })).toBeVisible();
    await expect(page.locator('.card-label', { hasText: 'Impayé en cours' })).toBeVisible();
  });

  test('affiche la section filtres avec les champs attendus', async ({ page }) => {
    await expect(page.locator('.filters-section')).toBeVisible();
    // Champs de filtre attendus
    await expect(page.locator('label:has-text("Commercial")')).toBeVisible();
    await expect(page.locator('label:has-text("Statut")')).toBeVisible();
  });

  test('affiche le tableau des ventes ou un état vide', async ({ page }) => {
    const table = page.locator('table');
    const emptyState = page.locator('td:has-text("Aucune vente")');
    await expect(table.or(emptyState).first()).toBeVisible();
  });

  test('le bouton "Nouvelle Vente" est visible pour admin', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Nouvelle Vente' })).toBeVisible();
  });

  test('ouvre le formulaire de création de vente', async ({ page }) => {
    await page.getByRole('button', { name: 'Nouvelle Vente' }).click();
    await expect(page.locator('.modal-overlay')).toBeVisible();
    // Le formulaire doit avoir un champ date et un champ client
    await expect(page.locator('label:has-text("Date"), label:has-text("Client")').first()).toBeVisible();
  });

  test('fermer le modal avec le bouton Annuler', async ({ page }) => {
    await page.getByRole('button', { name: 'Nouvelle Vente' }).click();
    await expect(page.locator('.modal-overlay')).toBeVisible();

    await page.locator('.modal-overlay').getByRole('button', { name: /Annuler|Fermer|✕/ }).first().click();
    await expect(page.locator('.modal-overlay')).not.toBeVisible();
  });

  test('le bouton Visualiser ouvre la modale de détail', async ({ page }) => {
    const firstBtn = page.locator('button[title="Voir"]').first();
    test.skip(await firstBtn.count() === 0, 'Aucune ligne dans le tableau');

    await firstBtn.click();
    await expect(page.locator('.modal-overlay')).toBeVisible();
    await expect(page.locator('h2', { hasText: 'Détail de la vente' })).toBeVisible();
  });

  test('les boutons Précédent / Suivant naviguent entre les enregistrements dans le détail', async ({ page }) => {
    const viewButtons = page.locator('button[title="Voir"]');
    // The table is loaded asynchronously — wait for the first row before counting.
    await viewButtons.first().waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {});
    const count = await viewButtons.count();
    test.skip(count < 2, 'Au moins deux lignes sont nécessaires');

    await viewButtons.first().click();
    const modal = page.locator('.modal-overlay').first();
    await expect(modal).toBeVisible();

    const prevBtn = modal.locator('.modal-nav button', { hasText: 'Précédent' });
    const nextBtn = modal.locator('.modal-nav button', { hasText: 'Suivant' });
    const position = modal.locator('.modal-nav-pos');

    await expect(position).toHaveText(/^1 \/ \d+$/);
    await expect(prevBtn).toBeDisabled();
    await expect(nextBtn).toBeEnabled();

    await nextBtn.click();
    await expect(modal).toBeVisible();
    await expect(position).toHaveText(/^2 \/ \d+$/);
    await expect(prevBtn).toBeEnabled();

    await page.keyboard.press('ArrowLeft');
    await expect(position).toHaveText(/^1 \/ \d+$/);
    await expect(prevBtn).toBeDisabled();

    await modal.locator('.modal-footer-actions button', { hasText: 'Fermer' }).click();
    await expect(modal).not.toBeVisible();
  });

  test('le bouton Modifier dans le détail ouvre le formulaire de modification', async ({ page }) => {
    const firstBtn = page.locator('button[title="Voir"]').first();
    test.skip(await firstBtn.count() === 0, 'Aucune ligne dans le tableau');

    await firstBtn.click();
    await expect(page.locator('.modal-overlay')).toBeVisible();

    const modifierBtn = page.locator('.modal-footer button', { hasText: 'Modifier' });
    await expect(modifierBtn).toBeVisible();
    await modifierBtn.click();

    await expect(page.locator('h2', { hasText: 'Modifier la vente' })).toBeVisible();
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

  test('affiche le nom du créateur dans la colonne "Créé par" après création d\'une vente', async ({ page }) => {
    test.skip(!createdSaleId || !creatorName, 'Impossible de créer une vente de test (partenaire ou stock disponible manquant)');

    await page.goto('/sales', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1')).toContainText('Ventes');

    await page.fill('input[placeholder="Nom du client..."]', CLIENT_NAME);
    await page.keyboard.press('Enter');

    const row = page.locator('tbody tr', { hasText: CLIENT_NAME });
    await expect(row).toHaveCount(1, { timeout: 15_000 });

    // 15e colonne du tableau : Actions, #, Date, Facture, Client, Ville,
    // Commercial, Qte, Partenaire, Mode(s) paiement, Total Vente, Marge,
    // Paiement, Statut, Créé par (index 0-based : 14).
    const creatorCell = row.locator('td').nth(14);
    await expect(creatorCell).toContainText(creatorName!, { timeout: 10_000 });
    await expect(creatorCell).not.toContainText('-');
  });
});
