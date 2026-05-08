import { test as base, Page } from '@playwright/test';

/**
 * Fixture qui fournit une page déjà authentifiée (token chargé depuis .auth/state.json).
 * Le storageState est configuré globalement dans playwright.config.ts, donc ce fixture
 * est surtout utile pour des tests qui ont besoin d'une page non-authentifiée.
 */
export const test = base;

/**
 * Fixture pour des tests nécessitant une page sans authentification (ex: tests de login).
 */
export const unauthTest = base.extend<{ unauthPage: Page }>({
  unauthPage: async ({ browser }, use) => {
    const ctx = await browser.newContext({ storageState: undefined });
    const page = await ctx.newPage();
    await use(page);
    await ctx.close();
  },
});

export { expect } from '@playwright/test';
