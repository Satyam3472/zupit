import { test, expect } from '@playwright/test';
import { cleanTestDb, getAdminAuth, getRiderAuth } from '../helpers/testDb.js';

test.describe('J13: Rider Cash Ledger, Floats & Deposits', () => {
  test.beforeEach(async () => {
    await cleanTestDb();
  });

  test('Rider balance equals collected minus purchases. Admin adds float_given and deposit_made entries.', async ({ request }) => {
    // -------------------------------------------------------------
    // Step 1: Complete an order delivery with Rider Sunil Kumar
    // -------------------------------------------------------------
    const { rider, tokens: riderTokens } = await getRiderAuth('9835123401');

    // Place order
    const orderRes = await request.post('/api/v1/orders', {
      headers: { 'x-forwarded-for': '10.13.0.1' },
      data: {
        name: 'Ledger Customer',
        mobile: '9835129131',
        houseArea: 'Hub Road',
        pincode: '811307',
        paymentMethod: 'cod',
        medicines: [{ name: 'Antibiotic', quantity: 1 }],
      },
    });
    expect(orderRes.status()).toBe(201);
    const orderData = await orderRes.json();
    const trackDetails = await (await request.get(`/api/v1/track/${orderData.trackingToken}`)).json();
    const orderId = trackDetails.order.id;

    // Accept, Start buying, Add Bill of ₹200, Submit Bill
    const acceptRes = await request.post(`/api/v1/rider/orders/${orderId}/accept`, {
      headers: { Authorization: `Bearer ${riderTokens.accessToken}` },
    });
    expect(acceptRes.status(), await acceptRes.text()).toBe(200);

    const buyRes = await request.post(`/api/v1/rider/orders/${orderId}/start-buying`, {
      headers: { Authorization: `Bearer ${riderTokens.accessToken}` },
    });
    expect(buyRes.status(), await buyRes.text()).toBe(200);

    const billRes = await request.post(`/api/v1/rider/orders/${orderId}/bills`, {
      headers: { Authorization: `Bearer ${riderTokens.accessToken}` },
      data: { pharmacyName: 'Jamui Med', amount: 200, billImageUrl: '/public/uploads/bill.jpg' },
    });
    expect(billRes.status(), await billRes.text()).toBe(200);

    const submitRes = await request.post(`/api/v1/rider/orders/${orderId}/submit-bills`, {
      headers: { Authorization: `Bearer ${riderTokens.accessToken}` },
      data: { customerConfirmedByCall: false },
    });
    expect(submitRes.status(), await submitRes.text()).toBe(200);

    // Deliver order with correct delivery code and collect cash
    const outForDeliveryTrack = await (await request.get(`/api/v1/track/${orderData.trackingToken}`)).json();
    const deliveryCode = outForDeliveryTrack.order.deliveryCode;

    const deliverRes = await request.post(`/api/v1/rider/orders/${orderId}/verify-delivery`, {
      headers: { Authorization: `Bearer ${riderTokens.accessToken}` },
      data: { deliveryCode, paymentMethodSelected: 'cod' },
    });
    expect(deliverRes.status()).toBe(200);

    // Verify rider balance after delivery:
    // Initial 0 - 200 (purchased) + 225 (collected: bill 200 + delivery 25) = 25.00
    const { token: adminToken } = await getAdminAuth('owner');
    const ledgerRes1 = await request.get(`/api/v1/admin/cash/ledger/${rider.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(ledgerRes1.status()).toBe(200);
    const ledgerData1 = await ledgerRes1.json();

    const list1 = ledgerData1.transactions || ledgerData1.ledger || [];
    const types = list1.map((e: any) => e.type);
    expect(types).toContain('purchase_spent');
    expect(types).toContain('cash_collected');

    const initialCash = Number(ledgerData1.rider.cashBalance);
    expect(initialCash).toBe(25);

    // -------------------------------------------------------------
    // Step 2: Admin adds float_given of ₹1,000
    // -------------------------------------------------------------
    const floatRes = await request.post('/api/v1/admin/cash/entry', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        riderId: rider.id,
        type: 'float_given',
        amount: 1000,
        notes: 'Morning float for purchases',
      },
    });
    expect(floatRes.status()).toBe(200);
    const floatData = await floatRes.json();
    expect(floatData.success).toBe(true);
    expect(Number(floatData.newBalance)).toBe(1025);

    // -------------------------------------------------------------
    // Step 3: Admin adds deposit_made of ₹400
    // -------------------------------------------------------------
    const depositRes = await request.post('/api/v1/admin/cash/entry', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        riderId: rider.id,
        type: 'deposit_made',
        amount: 400,
        notes: 'Midday cash deposit to hub cashier',
      },
    });
    expect(depositRes.status()).toBe(200);
    const depositData = await depositRes.json();
    expect(depositData.success).toBe(true);
    // 1025 - 400 = 625
    expect(Number(depositData.newBalance)).toBe(625);

    // Verify complete ledger history
    const finalLedgerRes = await request.get(`/api/v1/admin/cash/ledger/${rider.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const finalLedgerData = await finalLedgerRes.json();
    const finalList = finalLedgerData.transactions || finalLedgerData.ledger || [];
    const finalTypes = finalList.map((e: any) => e.type);
    expect(finalTypes).toContain('float_given');
    expect(finalTypes).toContain('deposit_made');
    expect(Number(finalLedgerData.rider.cashBalance)).toBe(625);
  });
});
