import { test, expect } from '@playwright/test';
import { cleanTestDb, getAdminAuth, getRiderAuth } from '../helpers/testDb.js';

test.describe('J14: Comprehensive Access Control & Role Boundary Tests', () => {
  test.beforeEach(async () => {
    await cleanTestDb();
  });

  test('Unauthenticated redirects, rider denied admin access & other riders orders, ops denied settings, token isolation', async ({ browser, request }) => {
    // -------------------------------------------------------------
    // 1. Unauthenticated Redirects from /admin and /rider
    // -------------------------------------------------------------
    const anonContext = await browser.newContext();
    const anonPage = await anonContext.newPage();

    // /admin -> /admin/login
    await anonPage.goto('/admin');
    await expect(anonPage).toHaveURL(/\/admin\/login/);

    // /rider -> /rider/login
    await anonPage.goto('/rider');
    await expect(anonPage).toHaveURL(/\/rider\/login/);
    await anonContext.close();

    // -------------------------------------------------------------
    // 2. Rider Cannot Access Admin Pages or Admin APIs
    // -------------------------------------------------------------
    const { tokens: rider1Tokens } = await getRiderAuth('9835123401');
    const riderContext = await browser.newContext();
    await riderContext.addCookies([
      { name: 'rider_access_token', value: rider1Tokens.accessToken, domain: 'localhost', path: '/' },
    ]);
    const riderPage = await riderContext.newPage();

    // Attempting /admin with rider token redirects to /admin/login
    await riderPage.goto('/admin');
    await expect(riderPage).toHaveURL(/\/admin\/login/);
    await riderContext.close();

    // Attempting Admin API with rider token returns 401
    const riderAdminApiRes = await request.get('/api/v1/admin/orders', {
      headers: { Authorization: `Bearer ${rider1Tokens.accessToken}` },
    });
    expect(riderAdminApiRes.status()).toBe(401);

    // -------------------------------------------------------------
    // 3. Rider Cannot Read or Modify Another Rider's Order
    // -------------------------------------------------------------
    const { tokens: rider2Tokens } = await getRiderAuth('9835123402');

    // Create order assigned to Rider 1
    const orderRes = await request.post('/api/v1/orders', {
      data: {
        name: 'Isolation Customer',
        mobile: '9835129141',
        houseArea: 'Boundary Chowk',
        pincode: '811307',
        paymentMethod: 'cod',
        medicines: [{ name: 'Eye Drops', quantity: 1 }],
      },
    });
    const orderData = await orderRes.json();
    const trackDetails = await (await request.get(`/api/v1/track/${orderData.trackingToken}`)).json();
    const orderId = trackDetails.order.id;

    // Rider 1 accepts order
    await request.post(`/api/v1/rider/orders/${orderId}/accept`, {
      headers: { Authorization: `Bearer ${rider1Tokens.accessToken}` },
    });

    // Rider 2 attempts to read Rider 1's order -> 403 UNAUTHORIZED
    const rider2ReadRes = await request.get(`/api/v1/rider/orders/${orderId}`, {
      headers: { Authorization: `Bearer ${rider2Tokens.accessToken}` },
    });
    expect(rider2ReadRes.status()).toBe(403);
    const readErr = await rider2ReadRes.json();
    expect(readErr.error).toBe('UNAUTHORIZED');

    // Rider 2 attempts to update item status on Rider 1's order -> 403 UNAUTHORIZED
    const itemId = trackDetails.order.items[0].id;
    const rider2UpdateRes = await request.post(`/api/v1/rider/orders/${orderId}/items/${itemId}/status`, {
      headers: { Authorization: `Bearer ${rider2Tokens.accessToken}` },
      data: { status: 'bought' },
    });
    expect(rider2UpdateRes.status()).toBe(403);

    // -------------------------------------------------------------
    // 4. Ops Role Cannot Edit Platform Settings
    // -------------------------------------------------------------
    const { token: opsToken } = await getAdminAuth('ops');
    const opsEditSettingsRes = await request.put('/api/v1/admin/settings', {
      headers: { Authorization: `Bearer ${opsToken}` },
      data: { delivery_fee: 50 },
    });
    expect(opsEditSettingsRes.status()).toBe(403);
    const opsErr = await opsEditSettingsRes.json();
    expect(opsErr.error).toBe('FORBIDDEN');

    // -------------------------------------------------------------
    // 5. Customer Tracking Token Cannot Read Another Customer's Order
    // -------------------------------------------------------------
    // Order 2
    const order2Res = await request.post('/api/v1/orders', {
      data: {
        name: 'Other Customer',
        mobile: '9835129142',
        houseArea: 'Private Lane',
        pincode: '811307',
        paymentMethod: 'cod',
        medicines: [{ name: 'Bandage', quantity: 1 }],
      },
    });
    const order2Data = await order2Res.json();

    // Querying with Order 1 token only returns Order 1
    const token1Read = await (await request.get(`/api/v1/track/${orderData.trackingToken}`)).json();
    expect(token1Read.order.orderNumber).toBe(orderData.orderNumber);
    expect(token1Read.order.orderNumber).not.toBe(order2Data.orderNumber);

    // Random non-existent token returns 404
    const fakeTokenRead = await request.get('/api/v1/track/00000000000000000000000000000000');
    expect(fakeTokenRead.status()).toBe(404);
  });
});
