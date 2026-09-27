import { test, expect, APIRequestContext } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Le stock n'entre qu'à la réception.
 *
 * Un achat « Attendu » (EN COURS) laisse le stock intact et s'affiche à part
 * (« +N attendus ») ; « Réceptionner » ouvre une confirmation qui liste
 * quantités et dépôts, puis fait entrer le stock. Une seconde réception est
 * refusée. L'achat de test est créé par l'API, puis supprimé — reçu, sa
 * suppression retire exactement ce que la réception a fait entrer.
 */

const TEST_BL = 'BL-E2E-RECEPTION';
const QUANTITY = 3;
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

interface Lot { id: number; quantity: number; expected_quantity?: number }

test.describe.serial('Réception d\'un achat attendu', () => {
  let headers: Record<string, string>;
  let purchaseId = 0;
  let productId = 0;
  let lotId = 0;
  let lotBefore = 0;
  let expectedBefore = 0;

  async function readLot(request: APIRequestContext): Promise<Lot> {
    const res = await request.get(`/api/stocks?product_id=${productId}&per_page=200`, { headers });
    expect(res.ok()).toBe(true);
    const lots = (await res.json()).data as Lot[];
    return lots.find(l => l.id === lotId)!;
  }

  test.beforeAll(async ({ request }) => {
    const token = getStoredToken();
    expect(token, 'jeton de session e2e introuvable').not.toBeNull();
    headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };

    // Un achat de test resté d'un passage interrompu : on le supprime.
    const left = await request.get(`/api/purchases?search=${TEST_BL}&per_page=100`, { headers });
    for (const p of ((await left.json()).data ?? []) as { id: number; bl_number: string | null }[]) {
      if (p.bl_number === TEST_BL) await request.delete(`/api/purchases/${p.id}`, { headers });
    }

    // Un pneu qui a un lot, chez n'importe quel fournisseur.
    const catalog = await request.get('/api/purchase-catalog?q=2055516', { headers });
    const product = ((await catalog.json()).data as { id: number; lots: { id: number }[] }[]).find(p => p.lots.length > 0);
    test.skip(!product, 'Aucun pneu 205/55R16 avec un lot en base');
    productId = product!.id;
    lotId = product!.lots[0].id;

    const filters = await (await request.get('/api/purchases-filters', { headers })).json();
    const lot = await readLot(request);
    lotBefore = lot.quantity;
    expectedBefore = lot.expected_quantity ?? 0;

    const created = await request.post('/api/purchases', {
      headers,
      data: {
        date: new Date().toISOString().slice(0, 10),
        with_invoice: false,
        bl_number: TEST_BL,
        supplier_id: filters.suppliers[0].id,
        commercial_id: filters.commercials[0].id,
        status: 'EN COURS',
        payment_status: 'NON PAYE',
        items: [{ product_id: productId, stock_id: lotId, quantity: QUANTITY, unit_price: 100 }],
      },
    });
    expect(created.status()).toBe(201);
    purchaseId = (await created.json()).id;
  });

  test.afterAll(async ({ request }) => {
    if (purchaseId) await request.delete(`/api/purchases/${purchaseId}`, { headers });
  });

  test('créer un achat attendu ne fait pas bouger le stock', async ({ request }) => {
    const lot = await readLot(request);
    expect(lot.quantity).toBe(lotBefore);
    expect(lot.expected_quantity).toBe(expectedBefore + QUANTITY);
  });

  test('la fiche produit montre les quantités attendues à part', async ({ page }) => {
    test.slow();
    await page.goto(`/products/${productId}/edit`);
    await expect(page.locator('.pf-block-note .qty-expected')).toContainText(`+${expectedBefore + QUANTITY} attendus`, { timeout: 25_000 });
  });

  test('la liste Achats montre l\'achat attendu avec « Réceptionner »', async ({ page }) => {
    test.slow();
    await page.goto('/achats');
    await expect(page.locator('h1')).toContainText('Achats', { timeout: 25_000 });
    await page.locator('.filter-bar').getByRole('button', { name: 'ATTENDUES' }).click();

    const row = page.locator('.list-grid-row').filter({ has: page.getByRole('link', { name: `Achat ${purchaseId}`, exact: true }) });
    await expect(row).toBeVisible({ timeout: 25_000 });
    await expect(row.locator('.list-grid-tag', { hasText: 'ATTENDU' })).toBeVisible();
    await expect(row.getByRole('button', { name: 'Réceptionner' })).toBeVisible();
  });

  test('« Réceptionner » confirme quantités et dépôt, puis le stock entre', async ({ page, request }) => {
    test.slow();
    await page.goto(`/achats/${purchaseId}`);
    await expect(page.locator('.sd-badge', { hasText: 'ATTENDU' })).toBeVisible({ timeout: 25_000 });
    await page.locator('.sd-actions').getByRole('button', { name: 'Réceptionner' }).click();

    const dialog = page.getByRole('dialog', { name: `Réceptionner l'achat ${purchaseId}` });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('.rc-consequence')).toHaveText(new RegExp(`^${QUANTITY} (pneus|articles) entrent en stock\\.$`));
    const line = dialog.locator('.rc-line:not(.rc-line--head)');
    await expect(line).toHaveCount(1);
    await expect(line.locator('.rc-qty')).toHaveText(`+${QUANTITY}`);
    await expect(line.locator('.rc-depot')).toContainText(`${lotBefore} → ${lotBefore + QUANTITY}`);

    // La date du jour par défaut ; une date passée est acceptée.
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    await expect(dialog.locator('input[type="date"]')).toHaveValue(`${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`);
    const yesterday = new Date(Date.now() - 86_400_000);
    const receivedAt = `${yesterday.getFullYear()}-${pad(yesterday.getMonth() + 1)}-${pad(yesterday.getDate())}`;
    await dialog.locator('input[type="date"]').fill(receivedAt);

    const [response] = await Promise.all([
      page.waitForResponse(r => r.url().endsWith(`/api/purchases/${purchaseId}/receive`) && r.request().method() === 'POST'),
      dialog.getByRole('button', { name: 'Réceptionner' }).click(),
    ]);
    expect(response.status()).toBe(200);

    await expect(dialog).toBeHidden();
    await expect(page.locator('.sd-badge', { hasText: 'ATTENDU' })).toHaveCount(0, { timeout: 15_000 });
    await expect(page.locator('.sd-actions').getByRole('button', { name: 'Réceptionner' })).toHaveCount(0);

    const lot = await readLot(request);
    expect(lot.quantity).toBe(lotBefore + QUANTITY);
    expect(lot.expected_quantity).toBe(expectedBefore);

    const purchase = await (await request.get(`/api/purchases/${purchaseId}`, { headers })).json();
    expect(purchase.status).toBe('RECU');
    expect(String(purchase.received_at).slice(0, 10)).toBe(receivedAt);
  });

  test('une seconde réception est refusée et le stock n\'entre qu\'une fois', async ({ request }) => {
    const res = await request.post(`/api/purchases/${purchaseId}/receive`, { headers });
    expect(res.status()).toBe(422);
    expect((await res.json()).errors.status[0]).toBe('Cet achat est déjà reçu.');

    const lot = await readLot(request);
    expect(lot.quantity).toBe(lotBefore + QUANTITY);
  });
});
