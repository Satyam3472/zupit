import { test, expect } from '@playwright/test';
import { cleanTestDb, testDb } from '../helpers/testDb.js';
import { customers } from '../../src/server/db/schema.js';

test.describe('J10: Order Rejection Rules', () => {
  test.beforeEach(async () => {
    await cleanTestDb();
  });

  test('Rejections: blocked customer, unserviceable pincode, invalid phone, empty order, 6th order in an hour', async ({ request }) => {
    // -------------------------------------------------------------
    // 1. Blocked Customer Rejection (403 CUSTOMER_BLOCKED)
    // -------------------------------------------------------------
    const blockedPhone = '9835129081';
    await testDb.insert(customers).values({
      name: 'Blocked User',
      phone: blockedPhone,
      isActive: false,
    });

    const blockedRes = await request.post('/api/v1/orders', {
      data: {
        name: 'Blocked User',
        mobile: blockedPhone,
        houseArea: 'Station Road',
        pincode: '811307',
        paymentMethod: 'cod',
        medicines: [{ name: 'Aspirin', quantity: 1 }],
      },
    });
    expect(blockedRes.status()).toBe(403);
    const blockedData = await blockedRes.json();
    expect(blockedData.error).toBe('CUSTOMER_BLOCKED');
    expect(blockedData.message).toContain('support team');

    // -------------------------------------------------------------
    // 2. Unserviceable Pincode Rejection (400 UNSERVICEABLE_PINCODE)
    // -------------------------------------------------------------
    const unserviceableRes = await request.post('/api/v1/orders', {
      data: {
        name: 'Remote Customer',
        mobile: '9835129082',
        houseArea: 'Distant Village',
        pincode: '999999',
        paymentMethod: 'cod',
        medicines: [{ name: 'Paracetamol', quantity: 1 }],
      },
    });
    expect(unserviceableRes.status()).toBe(400);
    const unserviceableData = await unserviceableRes.json();
    expect(unserviceableData.error).toBe('UNSERVICEABLE_PINCODE');
    expect(unserviceableData.message).toContain('do not deliver to this area yet');

    // -------------------------------------------------------------
    // 3. Invalid Phone Number Rejection (400 VALIDATION_ERROR)
    // -------------------------------------------------------------
    const invalidPhoneRes = await request.post('/api/v1/orders', {
      data: {
        name: 'Invalid Phone Customer',
        mobile: '12345', // Invalid
        houseArea: 'Main Chowk',
        pincode: '811307',
        paymentMethod: 'cod',
        medicines: [{ name: 'Paracetamol', quantity: 1 }],
      },
    });
    expect(invalidPhoneRes.status()).toBe(400);
    const invalidPhoneData = await invalidPhoneRes.json();
    expect(invalidPhoneData.error).toBe('VALIDATION_ERROR');

    // -------------------------------------------------------------
    // 4. Empty Order Rejection (400 EMPTY_ORDER)
    // -------------------------------------------------------------
    const emptyOrderRes = await request.post('/api/v1/orders', {
      data: {
        name: 'Empty Order Customer',
        mobile: '9835129083',
        houseArea: 'Gandhi Chowk',
        pincode: '811307',
        paymentMethod: 'cod',
        medicines: [],
        prescriptions: [],
      },
    });
    expect(emptyOrderRes.status()).toBe(400);
    const emptyOrderData = await emptyOrderRes.json();
    expect(emptyOrderData.error).toBe('VALIDATION_ERROR');
    expect(emptyOrderData.message).toContain('Please add at least one medicine or upload a prescription');

    // -------------------------------------------------------------
    // 5. 6th Order in an Hour from One Phone (429 PHONE_RATE_LIMIT_EXCEEDED)
    // -------------------------------------------------------------
    const rateLimitPhone = '9835129085';
    for (let i = 1; i <= 5; i++) {
      const orderRes = await request.post('/api/v1/orders', {
        headers: { 'x-forwarded-for': `10.10.1.${i}` },
        data: {
          name: `Rate Limit Tester ${i}`,
          mobile: rateLimitPhone,
          houseArea: 'Bazaar Road',
          pincode: '811307',
          paymentMethod: 'cod',
          medicines: [{ name: 'Cetirizine', quantity: 1 }],
        },
      });
      expect(orderRes.status()).toBe(201);
    }

    // 6th order from the same phone
    const sixthRes = await request.post('/api/v1/orders', {
      headers: { 'x-forwarded-for': '10.10.1.6' },
      data: {
        name: 'Rate Limit Tester 6',
        mobile: rateLimitPhone,
        houseArea: 'Bazaar Road',
        pincode: '811307',
        paymentMethod: 'cod',
        medicines: [{ name: 'Cetirizine', quantity: 1 }],
      },
    });
    expect(sixthRes.status()).toBe(429);
    const sixthData = await sixthRes.json();
    expect(sixthData.error).toBe('PHONE_RATE_LIMIT_EXCEEDED');
    expect(sixthData.message).toContain('Maximum order limit reached for this mobile number');
  });
});
