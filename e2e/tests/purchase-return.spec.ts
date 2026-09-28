import { test, expect, APIRequestContext, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Enregistrer un retour fournisseur, de bout en bout (refonte 2b, 12c).
 *
 * Deux achats reçus sont créés par l'API sur le même lot : l'un non réglé,
 * l'autre réglé. Sur le premier, un retour « Déduire du dû » : le stock sort,
 * le dû au fournisseur baisse du montant retourné, aucune transaction. Sur le
 * second, un retour « Remboursement reçu » : le stock sort et une entrée de
 * trésorerie est créée. Supprimer les deux achats rend au lot sa quantité de
 * départ.
 */

const TEST_BL = 'BL-E2E-RETOUR';
const QUANTITY = 4;
const UNIT_PRICE = 100;
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

/** Un montant tel que la page l'écrit (pipe number:'1.2-2', locale en-US). */
const money = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

test.describe.serial('Retour fournisseur — enregistrement', () => {
  let headers: Record<string, string>;
  let productId = 0;
  let lotId = 0;
  let supplierId = 0;
  let accountId = 0;
  let lotAtStart = 0;
  let unpaidId = 0;
  let paidId = 0;

  async function lotQuantity(request: APIRequestContext): Promise<number> {
    const res = await request.get(`/api/stocks?product_id=${productId}&per_page=200`, { headers });
    const lots = (await res.json()).data as { id: number; quantity: number }[];
    return lots.find(l => l.id === lotId)!.quantity;
  }

  async function supplierDue(request: APIRequestContext): Promise<number> {
    const res = await request.get(`/api/suppliers/${supplierId}/profile`, { headers });
    return Number((await res.json()).outstanding_balance);
  }

  async function createReceivedPurchase(request: APIRequestContext, commercialId: number): Promise<number> {
    const res = await request.post('/api/purchases', {
      headers,
      data: {
        date: new Date().toISOString().slice(0, 10),
        with_invoice: false,
        bl_number: TEST_BL,
        supplier_id: supplierId,
        commercial_id: commercialId,
        status: 'RECU',
        payment_status: 'NON PAYE',
        items: [{ product_id: productId, stock_id: lotId, quantity: QUANTITY, unit_price: UNIT_PRICE }],
      },
    });
    expect(res.status()).toBe(201);
    return (await res.json()).id;
  }

  /** Ouvre la fiche de l'achat, puis le volet « Retour fournisseur ». */
  async function openReturnPanel(page: Page, purchaseId: number) {
    await page.goto(`/achats/${purchaseId}`);
    await expect(page.locator('.sd-title')).toHaveText(`Achat ${purchaseId}`, { timeout: 25_000 });
    await page.locator('.sd-actions').getByRole('button', { name: 'Retour fournisseur' }).click();
    const panel = page.getByRole('dialog', { name: new RegExp(`Achat ${purchaseId}`) });
    await expect(panel).toBeVisible();
    await expect(panel.getByText("Chargement de l'achat…")).toBeHidden({ timeout: 25_000 });
    return panel;
  }

  test.beforeAll(async ({ request }) => {
    const token = getStoredToken();
    expect(token, 'jeton de session e2e introuvable').not.toBeNull();
    headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };

    // Des achats de test restés d'un passage interrompu : on les supprime.
    const left = await request.get(`/api/purchases?search=${TEST_BL}&per_page=100`, { headers });
    for (const p of ((await left.json()).data ?? []) as { id: number; bl_number: string | null }[]) {
      if (p.bl_number === TEST_BL) await request.delete(`/api/purchases/${p.id}`, { headers });
    }

    const catalog = await request.get('/api/purchase-catalog?q=2055516', { headers });
    const product = ((await catalog.json()).data as { id: number; lots: { id: number }[] }[]).find(p => p.lots.length > 0);
    test.skip(!product, 'Aucun pneu 205/55R16 avec un lot en base');
    productId = product!.id;
    lotId = product!.lots[0].id;

    const filters = await (await request.get('/api/purchases-filters', { headers })).json();
    supplierId = filters.suppliers[0].id;
    const accountsBody = await (await request.get('/api/accounts?all=1', { headers })).json();
    const accounts = (Array.isArray(accountsBody) ? accountsBody : accountsBody.data) as { id: number; is_active: boolean }[];
    accountId = accounts.find(a => a.is_active)!.id;

    lotAtStart = await lotQuantity(request);

    // Deux achats reçus : le stock entre à l'enregistrement.
    unpaidId = await createReceivedPurchase(request, filters.commercials[0].id);
    paidId = await createReceivedPurchase(request, filters.commercials[0].id);
    expect(await lotQuantity(request)).toBe(lotAtStart + 2 * QUANTITY);

    // Le second est réglé en entier : il y a de quoi rembourser.
    const pay = await request.post(`/api/purchases/${paidId}/payments`, {
      headers,
      data: { amount: QUANTITY * UNIT_PRICE, method: 'Espèces', date: new Date().toISOString().slice(0, 10), account_id: accountId },
    });
    expect(pay.status()).toBeLessThan(400);
  });

  test.afterAll(async ({ request }) => {
    // Filet de sécurité : le dernier test supprime déjà les achats.
    for (const id of [unpaidId, paidId]) {
      if (id) await request.delete(`/api/purchases/${id}`, { headers });
    }
  });

  test('« Déduire du dû » : le stock sort, le dû baisse, aucune transaction', async ({ page, request }) => {
    test.slow();
    const dueBefore = await supplierDue(request);
    const lotBefore = await lotQuantity(request);

    const panel = await openReturnPanel(page, unpaidId);
    const line = panel.locator('.pr-row:not(.pr-row--head)');
    await expect(line).toHaveCount(1);
    await expect(line.locator('.pr-remaining')).toHaveText(String(QUANTITY));

    // Le compteur : deux pneus, le montant suit.
    const plus = line.getByRole('button', { name: 'Retourner un de plus' });
    await plus.click();
    await plus.click();
    await expect(line.locator('.pr-counter input')).toHaveValue('2');
    await expect(line.locator('.pr-amount')).toHaveText(money(2 * UNIT_PRICE));

    await panel.locator('label.pr-field', { hasText: 'Motif' }).locator('select').selectOption({ label: 'Erreur de livraison' });

    // « Déduire du dû » par défaut, et le dû avant et après.
    await expect(panel.getByRole('button', { name: 'Déduire du dû' })).toHaveClass(/pr-seg--on/);
    const note = panel.locator('.pr-note');
    await expect(note).toContainText(`passe de ${money(dueBefore)}`, { timeout: 15_000 });
    await expect(note.locator('strong')).toHaveText(money(dueBefore - 2 * UNIT_PRICE));
    await expect(panel.locator('.pr-total strong')).toHaveText(`${money(2 * UNIT_PRICE)} DH`);

    const [saved] = await Promise.all([
      page.waitForResponse(r => r.url().endsWith(`/api/purchases/${unpaidId}/returns`) && r.request().method() === 'POST'),
      panel.getByRole('button', { name: 'Enregistrer le retour' }).click(),
    ]);
    expect(saved.status()).toBe(201);
    await expect(panel).toBeHidden();

    // La fiche liste le retour.
    const returnRow = page.locator('.sd-row--ret:not(.sd-row--head)');
    await expect(returnRow).toHaveCount(1, { timeout: 15_000 });
    await expect(returnRow).toContainText('Erreur de livraison');
    await expect(returnRow.locator('.sd-num').first()).toHaveText('2');

    // Stock, dû, trésorerie.
    expect(await lotQuantity(request)).toBe(lotBefore - 2);
    expect(await supplierDue(request)).toBeCloseTo(dueBefore - 2 * UNIT_PRICE, 2);
    const returns = await (await request.get(`/api/purchases/${unpaidId}/returns`, { headers })).json();
    expect(returns).toHaveLength(1);
    expect(Number(returns[0].refund_amount)).toBe(0);
    expect(returns[0].refund_transaction_id ?? null).toBeNull();
  });

  test('« Remboursement reçu » : le stock sort et l\'argent rentre en trésorerie', async ({ page, request }) => {
    test.slow();
    const lotBefore = await lotQuantity(request);

    const panel = await openReturnPanel(page, paidId);
    const line = panel.locator('.pr-row:not(.pr-row--head)');
    await line.getByRole('button', { name: 'Retourner un de plus' }).click();
    await expect(line.locator('.pr-amount')).toHaveText(money(UNIT_PRICE));

    await panel.getByRole('button', { name: 'Remboursement reçu' }).click();
    await expect(panel.getByRole('button', { name: 'Remboursement reçu' })).toHaveClass(/pr-seg--on/);

    // Le montant proposé : le moindre du retour et de ce qui reste à rembourser.
    const amount = panel.locator('label.pr-field', { hasText: 'Montant remboursé' }).locator('input');
    await expect(amount).toHaveValue(String(UNIT_PRICE));
    // Le volet choisit le premier compte actif en passant au remboursement.
    const account = panel.locator('label.pr-field', { hasText: 'Compte crédité' }).locator('select');
    expect(await account.evaluate((el: HTMLSelectElement) => el.selectedIndex)).toBeGreaterThan(0);
    await panel.locator('label.pr-field', { hasText: 'Méthode' }).locator('select').selectOption({ label: 'Espèces' });

    const [saved] = await Promise.all([
      page.waitForResponse(r => r.url().endsWith(`/api/purchases/${paidId}/returns`) && r.request().method() === 'POST'),
      panel.getByRole('button', { name: 'Enregistrer le retour' }).click(),
    ]);
    expect(saved.status()).toBe(201);
    await expect(panel).toBeHidden();
    await expect(page.locator('.sd-row--ret:not(.sd-row--head)')).toHaveCount(1, { timeout: 15_000 });

    expect(await lotQuantity(request)).toBe(lotBefore - 1);
    const returns = await (await request.get(`/api/purchases/${paidId}/returns`, { headers })).json();
    expect(returns).toHaveLength(1);
    expect(Number(returns[0].refund_amount)).toBe(UNIT_PRICE);
    expect(returns[0].refund_transaction_id).toBeTruthy();

    // L'entrée de trésorerie : un revenu « Remboursement fournisseur ».
    const tx = await (await request.get(`/api/transactions?search=${encodeURIComponent(`Remboursement retour achat #${paidId}`)}&per_page=20`, { headers })).json();
    const refund = (tx.data as { type: string; category: string; amount: string | number }[])[0];
    expect(refund).toBeTruthy();
    expect(refund.type).toBe('income');
    expect(refund.category).toBe('Remboursement fournisseur');
    expect(Number(refund.amount)).toBe(UNIT_PRICE);
  });

  test('supprimer les achats de test rend au lot sa quantité de départ', async ({ request }) => {
    for (const id of [unpaidId, paidId]) {
      const res = await request.delete(`/api/purchases/${id}`, { headers });
      expect(res.status()).toBeLessThan(400);
    }
    unpaidId = 0;
    paidId = 0;
    expect(await lotQuantity(request)).toBe(lotAtStart);
  });
});
