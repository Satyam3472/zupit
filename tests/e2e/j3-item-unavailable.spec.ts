import { test, expect } from '@playwright/test';
import { cleanTestDb, getRiderAuth } from '../helpers/testDb.js';

test.describe('J3: Unavailable Item & Customer Decisions', () => {
  test.beforeEach(async () => {
    await cleanTestDb();
  });

  test('Rider marks item unavailable -> customer Skip it, then Call me, then Cancel order', async ({ browser, request }) => {
    // -------------------------------------------------------------
    // Part A: Skip it flow
    // -------------------------------------------------------------
    // 1. Create order with 2 medicines
    const orderResA = await request.post('/api/v1/orders', {
      data: {
        name: 'Decision Customer A',
        mobile: '9835129011',
        houseArea: 'Patel Chowk',
        pincode: '811307',
        paymentMethod: 'cod',
        medicines: [
          { name: 'Azithromycin 500mg', quantity: 1 },
          { name: 'Cetirizine 10mg', quantity: 2 },
        ],
      },
    });
    expect(orderResA.status()).toBe(201);
    const orderDataA = await orderResA.json();

    const { tokens: riderTokens } = await getRiderAuth('9835123401');

    // 2. Rider accepts and starts buying
    const acceptResA = await request.post(`/api/v1/rider/orders/${orderDataA.orderNumber}/accept`, {
      headers: { Authorization: `Bearer ${riderTokens.accessToken}` },
    });
    // Or rider accepts by orderId
    const orderDetailsResA = await request.get(`/api/v1/track/${orderDataA.trackingToken}`);
    const orderDetailsA = await orderDetailsResA.json();
    const orderIdA = orderDetailsA.order.id;

    await request.post(`/api/v1/rider/orders/${orderIdA}/accept`, {
      headers: { Authorization: `Bearer ${riderTokens.accessToken}` },
    });
    await request.post(`/api/v1/rider/orders/${orderIdA}/start-buying`, {
      headers: { Authorization: `Bearer ${riderTokens.accessToken}` },
    });

    // 3. Rider marks first item unavailable
    const firstItemIdA = orderDetailsA.order.items[0].id;
    const itemStatusResA = await request.post(`/api/v1/rider/orders/${orderIdA}/items/${firstItemIdA}/status`, {
      headers: { Authorization: `Bearer ${riderTokens.accessToken}` },
      data: { status: 'unavailable', notes: 'Out of stock' },
    });
    expect(itemStatusResA.status()).toBe(200);

    // 4. Open customer tracking page in browser
    const customerContext = await browser.newContext({
      viewport: { width: 360, height: 800 },
      isMobile: true,
      hasTouch: true,
    });
    const customerPage = await customerContext.newPage();
    await customerPage.goto(`/track/${orderDataA.trackingToken}`);
    await customerPage.waitForLoadState('networkidle');

    // Verify unavailable item alert card is displayed
    const unavailAlert = customerPage.locator('#tracking-item-unavailable-alert');
    await expect(unavailAlert).toBeVisible({ timeout: 10000 });

    // Customer clicks "Skip it"
    const skipBtn = customerPage.locator('#btn-track-skip-item');
    await skipBtn.click();

    // Verify alert card disappears after skip
    await expect(unavailAlert).not.toBeVisible({ timeout: 10000 });

    // Verify timeline records customer skip decision
    const trackDetailsAfterSkip = await (await request.get(`/api/v1/track/${orderDataA.trackingToken}`)).json();
    const skipEvent = trackDetailsAfterSkip.order.timeline.find((t: any) =>
      t.notes.includes('skip') || t.metadata?.decision === 'skip'
    );
    expect(skipEvent).toBeDefined();

    // -------------------------------------------------------------
    // Part B: Call me flow
    // -------------------------------------------------------------
    const orderResB = await request.post('/api/v1/orders', {
      data: {
        name: 'Decision Customer B',
        mobile: '9835129012',
        houseArea: 'Court Compound',
        pincode: '811307',
        paymentMethod: 'cod',
        medicines: [{ name: 'Amoxicillin 500mg', quantity: 1 }],
      },
    });
    const orderDataB = await orderResB.json();
    const trackDetailsB = await (await request.get(`/api/v1/track/${orderDataDataBToken(orderDataB)}`)).json();
    const orderIdB = trackDetailsB.order.id;

    await request.post(`/api/v1/rider/orders/${orderIdB}/accept`, {
      headers: { Authorization: `Bearer ${riderTokens.accessToken}` },
    });
    await request.post(`/api/v1/rider/orders/${orderIdB}/start-buying`, {
      headers: { Authorization: `Bearer ${riderTokens.accessToken}` },
    });

    const firstItemIdB = trackDetailsB.order.items[0].id;
    await request.post(`/api/v1/rider/orders/${orderIdB}/items/${firstItemIdB}/status`, {
      headers: { Authorization: `Bearer ${riderTokens.accessToken}` },
      data: { status: 'unavailable', notes: 'Dose not in stock' },
    });

    await customerPage.goto(`/track/${orderDataB.trackingToken}`);
    await customerPage.waitForLoadState('networkidle');
    await expect(unavailAlert).toBeVisible({ timeout: 10000 });

    // Customer clicks "Call me"
    const callMeBtn = customerPage.locator('#btn-track-call-me');
    await callMeBtn.click();

    // Verify timeline recorded call requested
    const trackDetailsAfterCall = await (await request.get(`/api/v1/track/${orderDataB.trackingToken}`)).json();
    const callEvent = trackDetailsAfterCall.order.timeline.find((t: any) =>
      t.notes.includes('call') || t.metadata?.decision === 'call_me'
    );
    expect(callEvent).toBeDefined();

    // -------------------------------------------------------------
    // Part C: Cancel order flow
    // -------------------------------------------------------------
    const orderResC = await request.post('/api/v1/orders', {
      data: {
        name: 'Decision Customer C',
        mobile: '9835129013',
        houseArea: 'Station Road',
        pincode: '811307',
        paymentMethod: 'cod',
        medicines: [{ name: 'Insulin Pen', quantity: 1 }],
      },
    });
    const orderDataC = await orderResC.json();
    const trackDetailsC = await (await request.get(`/api/v1/track/${orderDataC.trackingToken}`)).json();
    const orderIdC = trackDetailsC.order.id;

    await request.post(`/api/v1/rider/orders/${orderIdC}/accept`, {
      headers: { Authorization: `Bearer ${riderTokens.accessToken}` },
    });
    await request.post(`/api/v1/rider/orders/${orderIdC}/start-buying`, {
      headers: { Authorization: `Bearer ${riderTokens.accessToken}` },
    });

    const firstItemIdC = trackDetailsC.order.items[0].id;
    await request.post(`/api/v1/rider/orders/${orderIdC}/items/${firstItemIdC}/status`, {
      headers: { Authorization: `Bearer ${riderTokens.accessToken}` },
      data: { status: 'unavailable', notes: 'Out of stock' },
    });

    await customerPage.goto(`/track/${orderDataC.trackingToken}`);
    await customerPage.waitForLoadState('networkidle');
    await expect(unavailAlert).toBeVisible({ timeout: 10000 });

    // Customer clicks "Cancel order"
    const cancelBtn = customerPage.locator('#btn-track-cancel-order');
    await cancelBtn.click();

    // Verify order is now cancelled
    await expect(customerPage.locator('#tracking-status-pill')).toContainText(/Cancelled|रद्द/i, { timeout: 10000 });
    const trackDetailsAfterCancel = await (await request.get(`/api/v1/track/${orderDataC.trackingToken}`)).json();
    expect(trackDetailsAfterCancel.order.status).toBe('cancelled');

    await customerContext.close();
  });
});

function orderDataDataBToken(orderDataB: any) {
  return orderDataB.trackingToken;
}
