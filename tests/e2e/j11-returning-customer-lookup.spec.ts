import { test, expect } from '@playwright/test';
import { cleanTestDb } from '../helpers/testDb.js';

test.describe('J11: Returning Customer Card & Track Lookup Privacy', () => {
  test.beforeEach(async () => {
    await cleanTestDb();
  });

  test('Returning customer sees welcome card. Track lookup works. Wrong phone and missing order return identical error.', async ({ browser, request }) => {
    // -------------------------------------------------------------
    // 1. Returning Customer Card in Browser (360x800)
    // -------------------------------------------------------------
    const customerContext = await browser.newContext({
      viewport: { width: 360, height: 800 },
      isMobile: true,
      hasTouch: true,
    });

    const customerPage = await customerContext.newPage();

    // Pre-populate localStorage with previous customer info
    await customerPage.addInitScript(() => {
      localStorage.setItem('zupit.customer', JSON.stringify({
        name: 'Pooja Singh',
        phone: '9835129091',
        address: 'Ward 5, Hospital Road',
        landmark: 'Opposite Sadar Hospital',
        pincode: '811307',
        payment: 'cod',
      }));
    });

    await customerPage.goto('/');
    await customerPage.waitForLoadState('networkidle');

    // Verify returning customer card is displayed
    const returningCard = customerPage.locator('#returning-customer-card');
    await expect(returningCard).toBeVisible({ timeout: 10000 });
    await expect(customerPage.locator('#returning-customer-prompt')).toContainText('Pooja Singh');

    // Click "Use these details" / card action
    const useDetailsBtn = customerPage.locator('#btn-use-returning-details, button:has-text("Use these details"), button:has-text("हाँ, यही विवरण रखें")').first();
    if (await useDetailsBtn.isVisible()) {
      await useDetailsBtn.click();
    }

    // Verify address inputs are auto-filled
    await expect(customerPage.locator('#field-full-name')).toHaveValue('Pooja Singh');
    await expect(customerPage.locator('#field-mobile')).toHaveValue('9835129091');
    await expect(customerPage.locator('#field-address')).toHaveValue('Ward 5, Hospital Road');

    // -------------------------------------------------------------
    // 2. Track Lookup By Phone + Order Number
    // -------------------------------------------------------------
    // Place order for lookup test
    const orderRes = await request.post('/api/v1/orders', {
      data: {
        name: 'Pooja Singh',
        mobile: '9835129091',
        houseArea: 'Ward 5, Hospital Road',
        pincode: '811307',
        paymentMethod: 'cod',
        medicines: [{ name: 'Paracetamol', quantity: 1 }],
      },
    });
    expect(orderRes.status()).toBe(201);
    const orderData = await orderRes.json();
    const orderNumber = orderData.orderNumber;

    // Successful lookup by correct phone + orderNumber
    const lookupSuccessRes = await request.post('/api/v1/track/lookup', {
      data: {
        orderNumber,
        phone: '9835129091',
      },
    });
    expect(lookupSuccessRes.status()).toBe(200);
    const lookupSuccessData = await lookupSuccessRes.json();
    expect(lookupSuccessData.success).toBe(true);
    expect(lookupSuccessData.token).toBe(orderData.trackingToken);

    // -------------------------------------------------------------
    // 3. Privacy: Identical Error on Wrong Phone vs Missing Order
    // -------------------------------------------------------------
    // Scenario A: Non-existent order number with any phone
    const missingOrderRes = await request.post('/api/v1/track/lookup', {
      data: {
        orderNumber: 'ZP-99999',
        phone: '9835129091',
      },
    });
    expect(missingOrderRes.status()).toBe(404);
    const missingOrderData = await missingOrderRes.json();

    // Scenario B: Real order number with WRONG phone
    const wrongPhoneRes = await request.post('/api/v1/track/lookup', {
      data: {
        orderNumber,
        phone: '9835129000', // Wrong phone
      },
    });
    expect(wrongPhoneRes.status()).toBe(404);
    const wrongPhoneData = await wrongPhoneRes.json();

    // Verify errors and messages are IDENTICAL
    expect(missingOrderData.error).toBe('NOT_FOUND');
    expect(wrongPhoneData.error).toBe('NOT_FOUND');
    expect(missingOrderData.message).toBe(wrongPhoneData.message);
    expect(missingOrderData.message).toContain('We could not find this order. Check the number and try again.');

    await customerContext.close();
  });
});
