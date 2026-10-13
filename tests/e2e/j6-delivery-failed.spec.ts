import { test, expect } from '@playwright/test';
import { cleanTestDb, getAdminAuth, getRiderAuth } from '../helpers/testDb.js';

test.describe('J6: Delivery Failure Flow', () => {
  test.beforeEach(async () => {
    await cleanTestDb();
  });

  test('Rider fails delivery with reason -> status becomes delivery_failed, admin sees it', async ({ browser, request }) => {
    // -------------------------------------------------------------
    // Step 1: Place order & transition to out_for_delivery
    // -------------------------------------------------------------
    const orderRes = await request.post('/api/v1/orders', {
      data: {
        name: 'Failure Customer',
        mobile: '9835129041',
        houseArea: 'Remote Area, Ward 9',
        pincode: '811307',
        paymentMethod: 'cod',
        medicines: [{ name: 'Pain Relief Spray', quantity: 1 }],
      },
    });
    expect(orderRes.status()).toBe(201);
    const orderData = await orderRes.json();

    const trackDetails = await (await request.get(`/api/v1/track/${orderData.trackingToken}`)).json();
    const orderId = trackDetails.order.id;

    const { rider, tokens: riderTokens } = await getRiderAuth('9835123401');

    // Rider accepts, starts buying, submits bill -> out_for_delivery
    await request.post(`/api/v1/rider/orders/${orderId}/accept`, {
      headers: { Authorization: `Bearer ${riderTokens.accessToken}` },
    });
    await request.post(`/api/v1/rider/orders/${orderId}/start-buying`, {
      headers: { Authorization: `Bearer ${riderTokens.accessToken}` },
    });
    await request.post(`/api/v1/rider/orders/${orderId}/bills`, {
      headers: { Authorization: `Bearer ${riderTokens.accessToken}` },
      data: {
        pharmacyName: 'City Chemist',
        billImageUrl: '/public/uploads/sample-bill.jpg',
        amount: 110,
      },
    });
    await request.post(`/api/v1/rider/orders/${orderId}/submit-bills`, {
      headers: { Authorization: `Bearer ${riderTokens.accessToken}` },
      data: { customerConfirmedByCall: false },
    });

    // -------------------------------------------------------------
    // Step 2: Rider (360x800) Fails Delivery in App
    // -------------------------------------------------------------
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

    // Tap active order / navigate to delivery screen
    const activeTab = riderPage.locator('#tab-active');
    if (await activeTab.isVisible()) {
      await activeTab.click();
    }

    // Click Could not deliver button
    const failBtn = riderPage.locator('button.btn-rider-danger-outline, button:has-text("Could not deliver"), button:has-text("डिलीवर नहीं हो सका")').first();
    await expect(failBtn).toBeVisible({ timeout: 10000 });
    await failBtn.click();

    // Select reason 'Customer unreachable'
    const modal = riderPage.locator('#modal-fail-delivery');
    await expect(modal).toBeVisible();
    await riderPage.check('input[name="fail-reason"][value="Customer unreachable"]');

    // Confirm failure
    await riderPage.click('#txt-fail-confirm-btn');

    // Verify modal closes
    await expect(modal).not.toBeVisible({ timeout: 10000 });

    // Verify backend order status is now delivery_failed
    const checkTrack = await (await request.get(`/api/v1/track/${orderData.trackingToken}`)).json();
    expect(checkTrack.order.status).toBe('delivery_failed');

    // -------------------------------------------------------------
    // Step 3: Admin (1440x900) Sees delivery_failed Status & Reason
    // -------------------------------------------------------------
    const { token: adminToken } = await getAdminAuth('owner');
    const adminContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await adminContext.addCookies([
      { name: 'admin_token', value: adminToken, domain: 'localhost', path: '/' },
    ]);

    const adminPage = await adminContext.newPage();
    await adminPage.goto('/admin');
    await adminPage.waitForLoadState('networkidle');

    const orderRow = adminPage.locator(`tr:has-text("${orderData.orderNumber}")`).first();
    await expect(orderRow).toBeVisible({ timeout: 10000 });
    await expect(orderRow).toContainText(/Failed|delivery_failed/i);

    // Click row to open detail modal
    await orderRow.click();
    const detailScreen = adminPage.locator('#screen-order-detail');
    await expect(detailScreen).toBeVisible();

    // Verify failure reason and event are displayed
    await expect(detailScreen).toContainText(/Customer unreachable/i);

    await riderContext.close();
    await adminContext.close();
  });
});
