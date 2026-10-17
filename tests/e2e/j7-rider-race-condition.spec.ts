import { test, expect } from '@playwright/test';
import { cleanTestDb, getRiderAuth } from '../helpers/testDb.js';

test.describe('J7: Concurrent Rider Accept Race Condition', () => {
  test.beforeEach(async () => {
    await cleanTestDb();
  });

  test('Two riders accept the same order concurrently: exactly one wins (200), the other gets 409 "Taken by another rider"', async ({ request }) => {
    // 1. Place order
    const orderRes = await request.post('/api/v1/orders', {
      data: {
        name: 'Race Customer',
        mobile: '9835129051',
        houseArea: 'Cinema Road',
        pincode: '811307',
        paymentMethod: 'cod',
        medicines: [{ name: 'Bandage', quantity: 2 }],
      },
    });
    expect(orderRes.status()).toBe(201);
    const orderData = await orderRes.json();

    const trackDetails = await (await request.get(`/api/v1/track/${orderData.trackingToken}`)).json();
    const orderId = trackDetails.order.id;

    // 2. Obtain tokens for two distinct riders
    const { rider: rider1, tokens: tokens1 } = await getRiderAuth('9835123401');
    const { rider: rider2, tokens: tokens2 } = await getRiderAuth('9835123402');

    // 3. Fire concurrent accept requests simultaneously
    const [res1, res2] = await Promise.all([
      request.post(`/api/v1/rider/orders/${orderId}/accept`, {
        headers: { Authorization: `Bearer ${tokens1.accessToken}` },
      }),
      request.post(`/api/v1/rider/orders/${orderId}/accept`, {
        headers: { Authorization: `Bearer ${tokens2.accessToken}` },
      }),
    ]);

    const statuses = [res1.status(), res2.status()].sort();
    // Exactly one should be 200, exactly one should be 409
    expect(statuses).toEqual([200, 409]);

    const winningRes = res1.status() === 200 ? res1 : res2;
    const losingRes = res1.status() === 409 ? res1 : res2;

    const winningData = await winningRes.json();
    expect(winningData.success).toBe(true);
    expect(winningData.message).toContain('Order accepted');

    const losingData = await losingRes.json();
    expect(losingData.success).toBe(false);
    expect(losingData.error).toBe('TAKEN_BY_ANOTHER_RIDER');
    expect(losingData.message).toContain('Taken by another rider');

    // 4. Verify in tracking info that assigned rider matches the winner
    const finalTrack = await (await request.get(`/api/v1/track/${orderData.trackingToken}`)).json();
    expect(finalTrack.order.status).toBe('rider_assigned');
    const winnerRiderId = res1.status() === 200 ? rider1.id : rider2.id;
    expect(finalTrack.order.rider.phone).toBe(res1.status() === 200 ? rider1.phone : rider2.phone);
  });
});
