import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const TEST_DESCRIPTION = 'E2E_TEST_TRANSACTION';
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
 * Cash Flow — refonte 2b. Une projection sur six semaines, un registre
 * (`.register-row`) avec ses onglets TOUT / À VENIR / ENTRÉES / SORTIES, les
 * filtres repliés derrière « Compte, catégorie, méthode », un volet droit
 * (comptes, en jeu, dépenses du mois). Le formulaire de transaction reste une
 * modale ; la suppression passe par la confirmation 15c.
 */

/** Les vraies lignes du registre — les squelettes n'ont pas de libellé. */
const registerRows = (page: Page) => page.locator('.register-row').filter({ has: page.locator('.move-main') });
const rowFor = (page: Page, description: string) => registerRows(page).filter({ hasText: description });

/** Déplie le panneau des filtres. */
async function openFilters(page: Page) {
  await page.locator('.register-bar .filter-toggle').click();
  const panel = page.locator('.filters-section');
  await expect(panel).toBeVisible();
  return panel;
}

/** Cherche une description dans le registre et attend la réponse. */
async function searchRegister(page: Page, text: string) {
  const panel = await openFilters(page);
  const input = panel.locator('label', { hasText: /^Rechercher$/ }).locator('..').locator('input');
  await input.fill(text);
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/api/transactions') && r.url().includes('search=') && r.request().method() === 'GET'),
    input.press('Enter'),
  ]);
}

test.describe.serial('Cash Flow', () => {
  test.beforeAll(async ({ request }) => {
    const token = getStoredToken();
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    const res = await request.get(
      `/api/transactions?search=${encodeURIComponent(TEST_DESCRIPTION)}&per_page=100`,
      { headers },
    );
    if (!res.ok()) return;
    const data = await res.json() as { data: { id: number; description: string }[] };
    for (const tx of data.data) {
      if (tx.description === TEST_DESCRIPTION) {
        await request.delete(`/api/transactions/${tx.id}`, { headers });
      }
    }
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/cash-flow');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('h1')).toContainText('Cash Flow', { timeout: 15_000 });
  });

  // ── Lecture ────────────────────────────────────────────────────────────────

  test('affiche la trésorerie du jour, la projection et le volet des comptes', async ({ page }) => {
    await expect(page.locator('.projection-label', { hasText: "Trésorerie aujourd'hui" })).toBeVisible();
    await expect(page.locator('.week-cell').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.aside-title', { hasText: /^Comptes$/ })).toBeVisible();
    await expect(page.locator('.aside-line--total .aside-name', { hasText: 'Disponible' })).toBeVisible();
  });

  test('affiche le registre et ses onglets', async ({ page }) => {
    const bar = page.locator('.register-bar');
    for (const tab of ['TOUT', /^À VENIR/, 'ENTRÉES', 'SORTIES']) {
      await expect(bar.getByRole('button', { name: tab })).toBeVisible();
    }
    await expect(page.locator('.register-count')).toContainText(/\d+ mouvement\(s\)/);
  });

  test('affiche les mouvements ou un état vide', async ({ page }) => {
    await expect(registerRows(page).first().or(page.locator('app-list-empty'))).toBeVisible({ timeout: 15_000 });
  });

  test('affiche tous les filtres attendus', async ({ page }) => {
    const panel = await openFilters(page);
    for (const label of ['Rechercher', 'Type', 'Compte', 'Catégorie', 'Personne', 'Partenaire', 'Du', 'Au']) {
      await expect(panel.locator('label', { hasText: new RegExp(`^${label}$`) })).toBeVisible();
    }
    await expect(panel.locator('label', { hasText: /^Montant min/ })).toBeVisible();
    await expect(panel.locator('label', { hasText: /^Montant max/ })).toBeVisible();
  });

  test('affiche le bouton "+ Nouvelle Transaction"', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Nouvelle Transaction/ })).toBeVisible();
  });

  // ── Formulaire de création ─────────────────────────────────────────────────

  test('ouvre le formulaire de nouvelle transaction', async ({ page }) => {
    await page.getByRole('button', { name: /Nouvelle Transaction/ }).click();
    const modal = page.locator('.modal-overlay').first();
    await expect(modal).toBeVisible();
    await expect(modal.locator('label:has-text("Date")').first()).toBeVisible();
    await expect(modal.locator('label:has-text("Montant")').first()).toBeVisible();
    await expect(modal.locator('label:has-text("Méthode")').first()).toBeVisible();
  });

  test('le champ Partenaire est un select (pas un champ texte libre)', async ({ page }) => {
    await page.getByRole('button', { name: /Nouvelle Transaction/ }).click();
    await expect(page.locator('.modal-overlay').first()).toBeVisible();
    const partnerSelect = page.locator('#txn-partner');
    await expect(partnerSelect).toBeVisible();
    expect(await partnerSelect.evaluate(el => el.tagName.toLowerCase())).toBe('select');
  });

  test('la liste des méthodes de paiement contient "Carte bancaire"', async ({ page }) => {
    await page.getByRole('button', { name: /Nouvelle Transaction/ }).click();
    await expect(page.locator('.modal-overlay').first()).toBeVisible();
    const options = await page.locator('#txn-method option').allTextContents();
    expect(options.map(o => o.trim())).toContain('Carte bancaire');
  });

  test('ferme le formulaire avec Annuler', async ({ page }) => {
    await page.getByRole('button', { name: /Nouvelle Transaction/ }).click();
    await expect(page.locator('.modal-overlay').first()).toBeVisible();
    await page.locator('.modal-overlay').getByRole('button', { name: /Annuler/ }).first().click();
    await expect(page.locator('.modal-overlay')).toHaveCount(0, { timeout: 5_000 });
  });

  // ── Création ──────────────────────────────────────────────────────────────

  test('créer une transaction de dépense (Espèces)', async ({ page }) => {
    test.setTimeout(60_000);

    await page.getByRole('button', { name: /Nouvelle Transaction/ }).click();
    const modal = page.locator('.modal-content');
    await expect(modal).toBeVisible();

    await modal.locator('.toggle-btn', { hasText: 'Dépense' }).click();
    await page.locator('#txn-amount').fill('150');
    await page.locator('#txn-account').selectOption({ index: 1 });
    await page.locator('#txn-category').selectOption({ index: 1 });
    await page.locator('#txn-method').selectOption({ label: 'Espèces' });
    await page.locator('#txn-person').selectOption({ index: 1 });
    await page.locator('#txn-description').fill(TEST_DESCRIPTION);

    const [postResp] = await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/transactions') && r.request().method() === 'POST'),
      modal.locator('button[type="submit"]').click(),
    ]);
    expect(postResp.status()).toBeLessThan(400);

    await expect(page.locator('.modal-overlay')).toHaveCount(0, { timeout: 10_000 });
    await expect(rowFor(page, TEST_DESCRIPTION).first()).toBeVisible({ timeout: 10_000 });
  });

  // ── Filtres ────────────────────────────────────────────────────────────────

  test('l\'onglet SORTIES retrouve la dépense créée', async ({ page }) => {
    await expect(registerRows(page).first().or(page.locator('app-list-empty'))).toBeVisible({ timeout: 15_000 });
    await page.locator('.register-bar').getByRole('button', { name: 'SORTIES' }).click();
    await expect(rowFor(page, TEST_DESCRIPTION).first()).toBeVisible({ timeout: 10_000 });
    await expect(rowFor(page, TEST_DESCRIPTION).first().locator('.cell-out')).toContainText('150');
  });

  test('filtrer par type "Dépenses" retrouve la transaction créée', async ({ page }) => {
    const panel = await openFilters(page);
    await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/transactions') && r.url().includes('type=expense') && r.request().method() === 'GET'),
      panel.locator('label', { hasText: /^Type$/ }).locator('..').locator('select').selectOption({ value: 'expense' }),
    ]);
    await expect(rowFor(page, TEST_DESCRIPTION).first()).toBeVisible({ timeout: 10_000 });
  });

  test('filtrer par recherche texte retrouve la transaction créée', async ({ page }) => {
    await searchRegister(page, TEST_DESCRIPTION);
    await expect(rowFor(page, TEST_DESCRIPTION).first()).toBeVisible({ timeout: 10_000 });
  });

  test('réinitialiser les filtres efface la recherche', async ({ page }) => {
    await searchRegister(page, 'quelque chose qui ne correspond pas');
    const panel = page.locator('.filters-section');
    await panel.locator('button[title="Réinitialiser"]').click();
    await expect(panel.locator('label', { hasText: /^Rechercher$/ }).locator('..').locator('input')).toHaveValue('');
  });

  // ── Échéances à venir ──────────────────────────────────────────────────────

  test('l\'onglet À VENIR ne montre que des échéances attendues ou prévues', async ({ page }) => {
    await expect(registerRows(page).first().or(page.locator('app-list-empty'))).toBeVisible({ timeout: 15_000 });
    await page.locator('.register-bar').getByRole('button', { name: /^À VENIR/ }).click();

    // L'onglet filtre en mémoire : attendre que les mouvements réalisés soient partis.
    await expect(registerRows(page).and(page.locator(':not(.register-row--pending)'))).toHaveCount(0, { timeout: 10_000 });
    const count = await registerRows(page).count();
    for (let i = 0; i < count; i++) {
      await expect(registerRows(page).nth(i).locator('.move-main')).toContainText(/ATTENDU|PRÉVU/);
    }
  });

  // ── Suppression ────────────────────────────────────────────────────────────

  test('supprimer la transaction de test', async ({ page }) => {
    test.setTimeout(60_000);

    await searchRegister(page, TEST_DESCRIPTION);
    const row = rowFor(page, TEST_DESCRIPTION).first();
    await expect(row).toBeVisible({ timeout: 10_000 });
    await row.locator('button[title="Supprimer"]').click();

    // Gabarit 15c : la confirmation partagée, plus de confirm() natif.
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible();
    const [delResp] = await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/transactions/') && r.request().method() === 'DELETE'),
      dialog.getByRole('button', { name: 'Supprimer' }).click(),
    ]);
    expect(delResp.status()).toBeLessThan(400);

    await expect(rowFor(page, TEST_DESCRIPTION)).toHaveCount(0, { timeout: 10_000 });
  });
});
