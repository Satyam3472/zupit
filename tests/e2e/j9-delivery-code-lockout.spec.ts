import { test, expect } from '@playwright/test';
import { cleanTestDb, getAdminAuth, getRiderAuth } from '../helpers/testDb.js';

test.describe('J9: Delivery Verification Code Lockout & Admin Reset', () => {
  test.beforeEach(async () => {
    await cleanTestDb();
  });

  test('Wrong delivery code five times locks attempts. Correct code after lockout is refused until admin resets.', async ({ request }) => {
    // 1. Place order & move to out_for_delivery
    const orderRes = await request.post('/api/v1/orders', {
      data: {
        name: 'Lockout Customer',
        mobile: '9835129071',
        houseArea: 'Rider Chowk',
        pincode: '811307',
        paymentMethod: 'cod',
        medicines: [{ name: 'Painkiller', quantity: 1 }],
      },
    });
    expect(orderRes.status()).toBe(201);
    const orderData = await orderRes.json();

    const trackDetails = await (await request.get(`/api/v1/track/${orderData.trackingToken}`)).json();
    const orderId = trackDetails.order.id;
    const correctCode = trackDetails.deliveryCode; // 4-digit code

    const { tokens: riderTokens } = await getRiderAuth('9835123401');

    await request.post(`/api/v1/rider/orders/${orderId}/accept`, {
      headers: { Authorization: `Bearer ${riderTokens.accessToken}` },
    });
    await request.post(`/api/v1/rider/orders/${orderId}/start-buying`, {
      headers: { Authorization: `Bearer ${riderTokens.accessToken}` },
    });
    await request.post(`/api/v1/rider/orders/${orderId}/bills`, {
      headers: { Authorization: `Bearer ${riderTokens.accessToken}` },
      data: { pharmacyName: 'Pharmacy', amount: 100, billImageUrl: '/public/uploads/bill.jpg' },
    });
    await request.post(`/api/v1/rider/orders/${orderId}/submit-bills`, {
      headers: { Authorization: `Bearer ${riderTokens.accessToken}` },
      data: { customerConfirmedByCall: false },
    });

    // 2. Submit wrong delivery code 5 times
    for (let attempt = 1; attempt <= 5; attempt++) {
      const wrongRes = await request.post(`/api/v1/rider/orders/${orderId}/verify-delivery`, {
        headers: { Authorization: `Bearer ${riderTokens.accessToken}` },
        data: { deliveryCode: '0000', paymentMethodSelected: 'cod' },
      });
      expect(wrongRes.status()).toBe(400);
      const wrongData = await wrongRes.json();
      expect(wrongData.error).toBe('INVALID_CODE');
    }

    // 3. 6th attempt (locked out): returns 429 ATTEMPTS_EXCEEDED
    const lockedRes = await request.post(`/api/v1/rider/orders/${orderId}/verify-delivery`, {
      headers: { Authorization: `Bearer ${riderTokens.accessToken}` },
      data: { deliveryCode: '0000', paymentMethodSelected: 'cod' },
    });
    expect(lockedRes.status()).toBe(429);
    const lockedData = await lockedRes.json();
    expect(lockedData.error).toBe('ATTEMPTS_EXCEEDED');
    expect(lockedData.message).toContain('Maximum delivery code attempts exceeded');

    // 4. Submitting CORRECT code after lockout is STILL REFUSED
    const correctWhileLockedRes = await request.post(`/api/v1/rider/orders/${orderId}/verify-delivery`, {
      headers: { Authorization: `Bearer ${riderTokens.accessToken}` },
      data: { deliveryCode: correctCode, paymentMethodSelected: 'cod' },
    });
    expect(correctWhileLockedRes.status()).toBe(429);
    const correctWhileLockedData = await correctWhileLockedRes.json();
    expect(correctWhileLockedData.error).toBe('ATTEMPTS_EXCEEDED');

    // 5. Admin resets delivery code
    const { token: adminToken } = await getAdminAuth('owner');
    const resetRes = await request.post(`/api/v1/admin/orders/${orderId}/reset-delivery-code`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(resetRes.status()).toBe(200);
    const resetData = await resetRes.json();
    expect(resetData.success).toBe(true);
    const newDeliveryCode = resetData.deliveryCode;
    expect(newDeliveryCode).toBeTruthy();

    // 6. Rider enters the new delivery code -> Succeeded with 200 delivered!
    const deliverSuccessRes = await request.post(`/api/v1/rider/orders/${orderId}/verify-delivery`, {
      headers: { Authorization: `Bearer ${riderTokens.accessToken}` },
      data: { deliveryCode: newDeliveryCode, paymentMethodSelected: 'cod' },
    });
    expect(deliverSuccessRes.status()).toBe(200);
    const deliverSuccessData = await deliverSuccessRes.json();
    expect(deliverSuccessData.success).toBe(true);
    expect(deliverSuccessData.order.status).toBe('delivered');
  });
});
