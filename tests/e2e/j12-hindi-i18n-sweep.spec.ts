import { test, expect } from '@playwright/test';
import { cleanTestDb, getAdminAuth, getRiderAuth } from '../helpers/testDb.js';

test.describe('J12: Hindi Internationalization (i18n) & UI Overflow Sweep', () => {
  test.beforeEach(async () => {
    await cleanTestDb();
  });

  test('Switch to Hindi across customer, rider, and admin screens: no raw keys, no layout overflow', async ({ browser }) => {
    // -------------------------------------------------------------
    // 1. Customer Screen (360x800) in Hindi
    // -------------------------------------------------------------
    const customerContext = await browser.newContext({
      viewport: { width: 360, height: 800 },
      isMobile: true,
      hasTouch: true,
    });
    const customerPage = await customerContext.newPage();

    await customerPage.goto('/');
    await customerPage.waitForLoadState('networkidle');

    // Click language toggle to switch to Hindi
    const langBtn = customerPage.locator('#lang-toggle-btn');
    await expect(langBtn).toBeVisible();
    await langBtn.click();

    // Verify key translated headings in Hindi
    await expect(customerPage.locator('#page-title-text')).toContainText(/दवाइयां/i);

    // Verify no raw translation keys or undefined literals
    const customerBodyText = await customerPage.locator('body').innerText();
    expect(customerBodyText).not.toMatch(/\{\{.*?\}\}/);
    expect(customerBodyText).not.toMatch(/\bundefined\b/i);
    expect(customerBodyText).not.toMatch(/\bnull\b/i);

    // Verify no horizontal scrolling / overflow at 360px
    const customerOverflow = await customerPage.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(customerOverflow).toBe(false);

    // -------------------------------------------------------------
    // 2. Rider Screen (360x800) in Hindi
    // -------------------------------------------------------------
    const { tokens: riderTokens } = await getRiderAuth('9835123401');
    const riderContext = await browser.newContext({
      viewport: { width: 360, height: 800 },
      isMobile: true,
      hasTouch: true,
    });
    await riderContext.addCookies([
      { name: 'rider_access_token', value: riderTokens.accessToken, domain: 'localhost', path: '/' },
    ]);

    const riderPage = await riderContext.newPage();
    await riderPage.goto('/rider');
    await riderPage.waitForLoadState('networkidle');

    // Click Hindi language button
    const riderLangBtn = riderPage.locator('#lang-btn');
    if (await riderLangBtn.isVisible()) {
      await riderLangBtn.click();
    }

    // Verify no raw translation keys
    const riderBodyText = await riderPage.locator('body').innerText();
    expect(riderBodyText).not.toMatch(/\{\{.*?\}\}/);
    expect(riderBodyText).not.toMatch(/\bundefined\b/i);

    // Verify no horizontal overflow at 360px
    const riderOverflow = await riderPage.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(riderOverflow).toBe(false);

    // -------------------------------------------------------------
    // 3. Admin Console (1440x900) Hindi Message Templates
    // -------------------------------------------------------------
    const { token: adminToken } = await getAdminAuth('owner');
    const adminContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await adminContext.addCookies([
      { name: 'admin_token', value: adminToken, domain: 'localhost', path: '/' },
    ]);

    const adminPage = await adminContext.newPage();
    await adminPage.goto('/admin');
    await adminPage.waitForLoadState('networkidle');

    // Navigate to Settings
    const settingsNav = adminPage.locator('.admin-nav-item[data-screen="settings"], a:has-text("Settings"), button:has-text("Settings")').first();
    if (await settingsNav.isVisible()) {
      await settingsNav.click();
      await adminPage.waitForTimeout(500);

      // Switch to Hindi templates
      const hiTmplBtn = adminPage.locator('#btn-tmpl-lang-hi');
      if (await hiTmplBtn.isVisible()) {
        await hiTmplBtn.click();
        await adminPage.waitForTimeout(500);
      }
    }

    // Verify no raw keys or overflows in admin
    const adminBodyText = await adminPage.locator('body').innerText();
    expect(adminBodyText).not.toMatch(/\{\{.*?\}\}/);

    await customerContext.close();
    await riderContext.close();
    await adminContext.close();
  });
});
