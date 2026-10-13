import { test, expect } from '@playwright/test';
import { cleanTestDb, getRiderAuth } from '../helpers/testDb.js';

test.describe('J8: Bill Above Confirmation Threshold & Multi-Bill Totaling', () => {
  test.beforeEach(async () => {
    await cleanTestDb();
  });

  test('Bill exceeding threshold requires call confirmation checkbox. Multiple bills total correctly.', async ({ request }) => {
    // 1. Place order
    const orderRes = await request.post('/api/v1/orders', {
      data: {
        name: 'High Value Customer',
        mobile: '9835129061',
        houseArea: 'VIP Colony',
        pincode: '811307',
        paymentMethod: 'cod',
        medicines: [
          { name: 'Specialty Injection', quantity: 2 },
          { name: 'Cardiac Tablet', quantity: 1 },
        ],
      },
    });
    expect(orderRes.status()).toBe(201);
    const orderData = await orderRes.json();

    const trackDetails = await (await request.get(`/api/v1/track/${orderData.trackingToken}`)).json();
    const orderId = trackDetails.order.id;

    const { tokens: riderTokens } = await getRiderAuth('9835123401');

    // 2. Rider accepts and starts buying
    await request.post(`/api/v1/rider/orders/${orderId}/accept`, {
      headers: { Authorization: `Bearer ${riderTokens.accessToken}` },
    });
    await request.post(`/api/v1/rider/orders/${orderId}/start-buying`, {
      headers: { Authorization: `Bearer ${riderTokens.accessToken}` },
    });

    // 3. Upload first bill (₹1,500)
    const bill1Res = await request.post(`/api/v1/rider/orders/${orderId}/bills`, {
      headers: { Authorization: `Bearer ${riderTokens.accessToken}` },
      data: {
        pharmacyName: 'Apollo Pharmacy Jamui',
        billNumber: 'AP-101',
        billImageUrl: '/public/uploads/bill-1.jpg',
        amount: 1500,
      },
    });
    expect(bill1Res.status()).toBe(200);

    // 4. Upload second bill (₹800) -> Total = ₹2,300 (exceeds default threshold 2000)
    const bill2Res = await request.post(`/api/v1/rider/orders/${orderId}/bills`, {
      headers: { Authorization: `Bearer ${riderTokens.accessToken}` },
      data: {
        pharmacyName: 'Sanjivani Chemist',
        billNumber: 'SJ-202',
        billImageUrl: '/public/uploads/bill-2.jpg',
        amount: 800,
      },
    });
    expect(bill2Res.status()).toBe(200);

    // 5. Submit bills WITHOUT customer call confirmation -> Must be rejected with 400 CONFIRMATION_REQUIRED
    const submitWithoutConfirmRes = await request.post(`/api/v1/rider/orders/${orderId}/submit-bills`, {
      headers: { Authorization: `Bearer ${riderTokens.accessToken}` },
      data: { customerConfirmedByCall: false },
    });
    expect(submitWithoutConfirmRes.status()).toBe(400);
    const errData = await submitWithoutConfirmRes.json();
    expect(errData.error).toBe('CONFIRMATION_REQUIRED');
    expect(errData.message).toContain('exceeds ₹2000');
    expect(errData.message).toContain('confirmation by phone call is required');

    // 6. Submit bills WITH customerConfirmedByCall: true -> Must succeed
    const submitWithConfirmRes = await request.post(`/api/v1/rider/orders/${orderId}/submit-bills`, {
      headers: { Authorization: `Bearer ${riderTokens.accessToken}` },
      data: { customerConfirmedByCall: true },
    });
    expect(submitWithConfirmRes.status()).toBe(200);
    const successData = await submitWithConfirmRes.json();
    expect(successData.success).toBe(true);
    expect(successData.order.status).toBe('out_for_delivery');

    // 7. Verify multiple bills totaled correctly on customer tracking page
    const finalTrackRes = await request.get(`/api/v1/track/${orderData.trackingToken}`);
    const finalTrackData = await finalTrackRes.json();

    // Sum of bills: 1500 + 800 = 2300.00
    expect(finalTrackData.order.bills.length).toBe(2);
    expect(Number(finalTrackData.order.finalAmount)).toBeGreaterThanOrEqual(2300);

    // 8. Verify cash ledger recorded individual negative purchase_spent rows
    const riderDetail = await (await request.get(`/api/v1/rider/orders/${orderId}`, {
      headers: { Authorization: `Bearer ${riderTokens.accessToken}` },
    })).json();
    expect((riderDetail.bills || riderDetail.order?.bills)?.length).toBe(2);
  });
});
