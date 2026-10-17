import { test, expect } from '@playwright/test';
import { cleanTestDb, getAdminAuth, getRiderAuth, ensureTestFixtures } from '../helpers/testDb.js';

test.describe('J2: Prescription Upload Order Flow (JPG & PDF)', () => {
  test.beforeEach(async () => {
    await cleanTestDb();
  });

  test('Guest uploads prescription JPG & PDF, places COD, rider buys & delivers, admin sees files', async ({ browser }) => {
    const { jpgPath, pdfPath } = ensureTestFixtures();

    // -------------------------------------------------------------
    // Step 1: Customer (Mobile 360x800) Uploads JPG and PDF
    // -------------------------------------------------------------
    const customerContext = await browser.newContext({
      viewport: { width: 360, height: 800 },
      isMobile: true,
      hasTouch: true,
    });
    const customerPage = await customerContext.newPage();
    await customerPage.goto('/');
    await customerPage.waitForLoadState('networkidle');

    // Switch to Upload prescription tab
    const uploadTab = customerPage.locator('#seg-upload-btn');
    await uploadTab.click();

    // Upload both JPG and PDF files
    const fileInput = customerPage.locator('#file-gallery-input');
    await fileInput.setInputFiles([jpgPath, pdfPath]);

    // Verify upload thumbnails or count
    await expect(customerPage.locator('.rx-thumb-item, .prescription-thumb, .upload-badge').first()).toBeVisible({ timeout: 10000 });

    // Fill customer address and contact
    await customerPage.fill('#field-full-name', 'Sneha Kumari');
    await customerPage.fill('#field-mobile', '9835129002');
    await customerPage.fill('#field-address', 'Court Road, Ward 2');
    await customerPage.fill('#field-landmark', 'Opposite Civil Court');
    await customerPage.fill('#field-pincode', '811307');

    const consentCheck = customerPage.locator('#rx-consent-check');
    if (await consentCheck.isVisible()) {
      await consentCheck.check();
    }

    // Place Order
    const placeOrderBtn = customerPage.locator('#place-order-submit-btn');
    await placeOrderBtn.click();

    await customerPage.waitForURL(/\/order\/placed/);
    const orderNumber = (await customerPage.locator('#placed-order-id').textContent())?.trim() || '';
    expect(orderNumber).toMatch(/^ZP-\d+$/);

    // Track order
    await customerPage.locator('#btn-track-placed-order, #btn-track-active-order').click();
    await customerPage.waitForURL(/\/track\//);

    // -------------------------------------------------------------
    // Step 2: Rider Accepts and Views Prescriptions
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

    // Online switch
    const dutySwitch = riderPage.locator('#duty-switch');
    if (await dutySwitch.evaluate(el => el.classList.contains('offline'))) {
      await dutySwitch.click();
      await expect(riderPage.locator('#duty-switch.online')).toBeVisible({ timeout: 5000 });
    }

    // Accept order
    const acceptBtn = riderPage.locator(`button[data-order-number="${orderNumber}"], .btn-accept-order`).first();
    await expect(acceptBtn).toBeVisible({ timeout: 10000 });
    await acceptBtn.click();

    // Rider enters order detail & views prescription thumbnails
    const rxThumbnails = riderPage.locator('.prescription-thumb, .rx-thumbnail, img[alt="Prescription"]');
    await expect(rxThumbnails.first()).toBeVisible({ timeout: 10000 });

    // Start buying
    const startBuyingBtn = riderPage.locator('#btn-start-buying, button:has-text("Start buying"), button:has-text("खरीदना शुरू करें")').first();
    await expect(startBuyingBtn).toBeVisible({ timeout: 10000 });
    await startBuyingBtn.click();

    // Fill pharmacy & bill
    const pharmacyInput = riderPage.locator('#input-pharmacy-name');
    if (await pharmacyInput.isVisible()) {
      await pharmacyInput.fill('Jamui Central Pharmacy');
    }
    const billAmountInput = riderPage.locator('#input-bill-amount');
    if (await billAmountInput.isVisible()) {
      await billAmountInput.fill('320');
    }

    const submitBillsBtn = riderPage.locator('#btn-submit-bills, button:has-text("Submit bills"), button:has-text("बिल सबमिट करें")').first();
    if (await submitBillsBtn.isVisible()) {
      await submitBillsBtn.click();
    }

    // -------------------------------------------------------------
    // Step 3: Delivery with 4-Digit Code
    // -------------------------------------------------------------
    await customerPage.reload();
    await customerPage.waitForLoadState('networkidle');

    const codeElem = customerPage.locator('#track-delivery-code, .track-delivery-code-badge, [data-testid="delivery-code"]').first();
    await expect(codeElem).toBeVisible({ timeout: 10000 });
    const deliveryCode = (await codeElem.textContent())?.replace(/\D/g, '').trim() || '';

    const riderCodeInput = riderPage.locator('#input-delivery-code');
    await expect(riderCodeInput).toBeVisible({ timeout: 10000 });
    await riderCodeInput.fill(deliveryCode);

    const completeDeliveryBtn = riderPage.locator('#btn-complete-delivery, button:has-text("Confirm Delivery"), button:has-text("डिलीवरी पूरी करें")').first();
    await completeDeliveryBtn.click();

    await expect(riderPage.locator('body')).toContainText(/Delivered|डिलीवरी पूरी|Success/i);

    // -------------------------------------------------------------
    // Step 4: Admin Confirms Prescriptions & Order Detail
    // -------------------------------------------------------------
    const { token: adminToken } = await getAdminAuth('owner');
    const adminContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await adminContext.addCookies([
      { name: 'admin_token', value: adminToken, domain: 'localhost', path: '/' },
    ]);

    const adminPage = await adminContext.newPage();
    await adminPage.goto('/admin');
    await adminPage.waitForLoadState('networkidle');

    const orderRow = adminPage.locator(`tr:has-text("${orderNumber}")`).first();
    await expect(orderRow).toBeVisible({ timeout: 10000 });
    await orderRow.click();

    const modal = adminPage.locator('#modal-order-detail, .order-detail-container').first();
    await expect(modal).toBeVisible();

    // Verify prescriptions visible in admin
    await expect(modal.locator('.rx-thumbnail-card, img[alt*="Rx"], [data-rx-id]').first()).toBeVisible();

    await customerContext.close();
    await riderContext.close();
    await adminContext.close();
  });
});
