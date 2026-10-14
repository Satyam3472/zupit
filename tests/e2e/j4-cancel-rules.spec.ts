import { test, expect } from '@playwright/test';
import { cleanTestDb, getRiderAuth } from '../helpers/testDb.js';

test.describe('J4: Order Cancellation Rules', () => {
  test.beforeEach(async () => {
    await cleanTestDb();
  });

  test('Customer cancels before buying (works). After buying starts, cancel is refused.', async ({ browser, request }) => {
    // -------------------------------------------------------------
    // Scenario 1: Cancellation before buying works
    // -------------------------------------------------------------
    const customerContext = await browser.newContext({
      viewport: { width: 360, height: 800 },
      isMobile: true,
      hasTouch: true,
    });
    const customerPage = await customerContext.newPage();

    // Place order
    const orderRes1 = await request.post('/api/v1/orders', {
      data: {
        name: 'Cancel Allowed Customer',
        mobile: '9835129021',
        houseArea: 'Station Road',
        pincode: '811307',
        paymentMethod: 'cod',
        medicines: [{ name: 'Paracetamol', quantity: 1 }],
      },
    });
    expect(orderRes1.status()).toBe(201);
    const order1 = await orderRes1.json();

    // Open tracking page
    await customerPage.goto(`/track/${order1.trackingToken}`);
    await customerPage.waitForLoadState('networkidle');

    // Verify Cancel link is visible before buying
    const cancelLink = customerPage.locator('#cancel-order-link-btn');
    await expect(cancelLink).toBeVisible({ timeout: 10000 });

    // Click cancel link
    await cancelLink.click();

    // Confirm cancel in dialog / prompt
    const confirmCancelBtn = customerPage.locator('#btn-confirm-cancel, #btn-confirm-cancel-order, button:has-text("Yes, Cancel"), button:has-text("रद्द करें")').first();
    if (await confirmCancelBtn.isVisible()) {
      await confirmCancelBtn.click();
    }

    // Verify status changed to cancelled
    await expect(customerPage.locator('#tracking-status-pill')).toContainText(/Cancelled|रद्द/i, { timeout: 10000 });

    // Check backend API confirms cancelled
    const checkRes1 = await request.get(`/api/v1/track/${order1.trackingToken}`);
    const checkData1 = await checkRes1.json();
    expect(checkData1.order.status).toBe('cancelled');

    // -------------------------------------------------------------
    // Scenario 2: Cancellation after buying starts is refused
    // -------------------------------------------------------------
    // Place second order
    const orderRes2 = await request.post('/api/v1/orders', {
      data: {
        name: 'Cancel Refused Customer',
        mobile: '9835129022',
        houseArea: 'Gandhi Chowk',
        pincode: '811307',
        paymentMethod: 'cod',
        medicines: [{ name: 'Amoxicillin', quantity: 1 }],
      },
    });
    expect(orderRes2.status()).toBe(201);
    const order2 = await orderRes2.json();

    const trackDetails2 = await (await request.get(`/api/v1/track/${order2.trackingToken}`)).json();
    const orderId2 = trackDetails2.order.id;

    // Rider accepts and starts buying
    const { tokens: riderTokens } = await getRiderAuth('9835123401');
    await request.post(`/api/v1/rider/orders/${orderId2}/accept`, {
      headers: { Authorization: `Bearer ${riderTokens.accessToken}` },
    });
    await request.post(`/api/v1/rider/orders/${orderId2}/start-buying`, {
      headers: { Authorization: `Bearer ${riderTokens.accessToken}` },
    });

    // Open tracking page in buying status
    await customerPage.goto(`/track/${order2.trackingToken}`);
    await customerPage.waitForLoadState('networkidle');

    // Verify status is buying
    await expect(customerPage.locator('#tracking-status-pill')).toContainText(/Buying|खरीद रहे हैं/i);

    // Verify cancel link is hidden once buying starts
    await expect(cancelLink).not.toBeVisible();

    // Verify API refuses cancel with 400 CANNOT_CANCEL
    const apiCancelRes = await request.post(`/api/v1/track/${order2.trackingToken}/cancel`, {
      data: { reason: 'Changed mind' },
    });
    expect(apiCancelRes.status()).toBe(400);
    const apiCancelData = await apiCancelRes.json();
    expect(apiCancelData.error).toBe('CANNOT_CANCEL');
    expect(apiCancelData.message).toContain('Orders can only be cancelled before medicine purchase begins');

    await customerContext.close();
  });
});
