import { test, expect } from '@playwright/test';
import { cleanTestDb, getAdminAuth, getRiderAuth } from '../helpers/testDb.js';

test.describe('J1: Complete Guest COD Order Flow', () => {
  test.beforeEach(async () => {
    await cleanTestDb();
  });

  test('Guest types medicines, places COD, rider accepts, buys, bills, delivers, rates, admin confirms', async ({ browser }) => {
    // -------------------------------------------------------------
    // Step 1: Customer (Mobile 360x800) Places COD Order
    // -------------------------------------------------------------
    const customerContext = await browser.newContext({
      viewport: { width: 360, height: 800 },
      isMobile: true,
      hasTouch: true,
    });
    const customerPage = await customerContext.newPage();

    await customerPage.goto('/');
    await customerPage.waitForLoadState('networkidle');

    // Verify online payment option is NOT shown (Step 0)
    const onlinePaymentOption = customerPage.locator('#pay-card-online');
    await expect(onlinePaymentOption).not.toBeVisible();

    // Type medicine
    const medInput = customerPage.locator('.med-name-input, .med-input-name').first();
    await medInput.fill('Paracetamol 500mg');

    // Fill customer address and contact
    await customerPage.fill('#field-full-name', 'Aakash Verma');
    await customerPage.fill('#field-mobile', '9835129001');
    await customerPage.fill('#field-address', 'Hospital Road, Ward 4');
    await customerPage.fill('#field-landmark', 'Near Sadar Hospital');
    await customerPage.fill('#field-pincode', '811307');

    // Place Order
    const placeOrderBtn = customerPage.locator('#place-order-submit-btn');
    await placeOrderBtn.click();

    // Verify redirected to /order/placed
    await customerPage.waitForURL(/\/order\/placed/);
    const orderNumberElem = customerPage.locator('#placed-order-id');
    await expect(orderNumberElem).toBeVisible();
    const orderNumber = (await orderNumberElem.textContent())?.trim() || '';
    expect(orderNumber).toMatch(/^ZP-\d+$/);

    // Click Track Order
    const trackOrderBtn = customerPage.locator('#btn-track-placed-order, #btn-track-active-order');
    await trackOrderBtn.click();
    await customerPage.waitForURL(/\/track\//);

    // Verify on tracking screen with initial status
    await expect(customerPage.locator('#tracking-order-id, #track-order-id')).toContainText(orderNumber);
    await expect(customerPage.locator('#tracking-status-pill, #track-status-pill')).toContainText(/Order Placed|ऑर्डर मिला|Placed/i);

    const trackingUrl = customerPage.url();
    const trackingToken = trackingUrl.split('/track/')[1];
    expect(trackingToken).toBeTruthy();

    // -------------------------------------------------------------
    // Step 2: Rider (Mobile 360x800) Accepts the Order
    // -------------------------------------------------------------
    const { rider, tokens: riderTokens } = await getRiderAuth('9835123401');

    const riderContext = await browser.newContext({
      viewport: { width: 360, height: 800 },
      isMobile: true,
      hasTouch: true,
    });
    // Set rider cookie
    await riderContext.addCookies([
      {
        name: 'rider_access_token',
        value: riderTokens.accessToken,
        domain: 'localhost',
        path: '/',
      },
    ]);

    const riderPage = await riderContext.newPage();
    await riderPage.goto('/rider');
    await riderPage.waitForLoadState('networkidle');

    // Check online toggle
    const dutySwitch = riderPage.locator('#duty-switch');
    if (await dutySwitch.evaluate(el => el.classList.contains('offline'))) {
      await dutySwitch.click();
      await expect(riderPage.locator('#duty-switch.online')).toBeVisible({ timeout: 5000 });
    }

    // Locate open order and tap Accept
    const acceptBtn = riderPage.locator(`button[data-order-number="${orderNumber}"], .btn-accept-order`).first();
    await expect(acceptBtn).toBeVisible({ timeout: 10000 });
    await acceptBtn.click();

    // -------------------------------------------------------------
    // Step 3: Rider Buys Medicines and Uploads Bill
    // -------------------------------------------------------------
    // Tap Start Buying
    const startBuyingBtn = riderPage.locator('#btn-start-buying, button:has-text("Start buying"), button:has-text("खरीदना शुरू करें")').first();
    await expect(startBuyingBtn).toBeVisible({ timeout: 10000 });
    await startBuyingBtn.click();

    // Mark medicine item as bought
    const markBoughtBtn = riderPage.locator('.btn-item-bought, button:has-text("Bought"), button:has-text("खरीदा")').first();
    if (await markBoughtBtn.isVisible()) {
      await markBoughtBtn.click();
    }

    // Tap Upload bill to open bill view
    const openBillBtn = riderPage.locator('button:has-text("Upload bill"), button:has-text("बिल अपलोड करें")').first();
    await openBillBtn.click();

    const billAmountInput = riderPage.locator('#bill-amount-input, #input-bill-amount').first();
    if (await billAmountInput.isVisible()) {
      await billAmountInput.fill('150');
    }

    const addBillBtn = riderPage.locator('#btn-add-bill-to-list');
    if (await addBillBtn.isVisible()) {
      await addBillBtn.click();
      await expect(riderPage.locator('#card-bills-list')).toBeVisible({ timeout: 5000 });
    }

    // Submit Bills to proceed to out_for_delivery
    const submitBillsBtn = riderPage.locator('#btn-submit-bills-cta, #btn-submit-bills, button:has-text("Submit bills"), button:has-text("Submit and go to delivery"), button:has-text("बिल सबमिट करें")').first();
    if (await submitBillsBtn.isVisible()) {
      await Promise.all([
        riderPage.waitForResponse(resp => resp.url().includes('/submit-bills') && resp.status() === 200),
        submitBillsBtn.click(),
      ]);
    }

    // -------------------------------------------------------------
    // Step 4: Out for Delivery & 4-Digit Code Verification
    // -------------------------------------------------------------
    // Reload tracking page to get the 4-digit code
    await customerPage.reload();
    await customerPage.waitForLoadState('networkidle');

    // Verify status is out for delivery
    await expect(customerPage.locator('#tracking-status-pill, #track-status-pill')).toContainText(/Out for delivery|डिलीवरी के लिए निकल चुके हैं/i);

    // Retrieve delivery code shown on customer page
    const codeElem = customerPage.locator('#track-delivery-code, .track-delivery-code-badge, [data-testid="delivery-code"]').first();
    await expect(codeElem).toBeVisible({ timeout: 10000 });
    const deliveryCode = (await codeElem.textContent())?.replace(/\D/g, '').trim() || '';
    expect(deliveryCode.length).toBe(4);

    // Verify Cash on Delivery message on customer tracking page (Step 0)
    await expect(customerPage.locator('body')).toContainText(/Pay ₹.*in cash to the rider/i);
    // Verify Pay Now button is NOT present (Step 0)
    await expect(customerPage.locator('#btn-bill-pay-now')).not.toBeVisible();

    // Rider completes delivery with the 4-digit code
    const codeBox1 = riderPage.locator('#code-box-1, #input-delivery-code').first();
    await expect(codeBox1).toBeVisible({ timeout: 10000 });
    if (await riderPage.locator('#code-box-1').isVisible()) {
      for (let i = 0; i < 4; i++) {
        await riderPage.fill(`#code-box-${i + 1}`, deliveryCode[i]);
      }
    } else {
      await codeBox1.fill(deliveryCode);
    }

    // Confirm Cash collected and verify delivery
    const completeDeliveryBtn = riderPage.locator('#btn-verify-delivery-cta, #btn-verify-complete-btn, #btn-complete-delivery, button:has-text("Verify Code & Deliver"), button:has-text("Confirm Delivery"), button:has-text("डिलीवरी पूरी करें")').first();
    await completeDeliveryBtn.click();

    // Verify rider sees delivery success
    await expect(riderPage.locator('body')).toContainText(/Delivered|डिलीवरी पूरी|Success/i);

    // -------------------------------------------------------------
    // Step 5: Customer Rates Delivered Order
    // -------------------------------------------------------------
    await customerPage.reload();
    await customerPage.waitForLoadState('networkidle');

    await expect(customerPage.locator('#tracking-status-pill, #track-status-pill')).toContainText(/Delivered|डिलीवर हो गया/i);

    // Submit 5-star rating
    const star5 = customerPage.locator('.rating-star-btn[data-rating="5"], .star-btn[data-val="5"], .star-btn[data-star="5"]').first();
    if (await star5.isVisible()) {
      await star5.click();
      const feedbackInput = customerPage.locator('#rating-comment-input, #feedback-textarea').first();
      if (await feedbackInput.isVisible()) {
        await feedbackInput.fill('Excellent and prompt service in Jamui!');
      }
      const submitRatingBtn = customerPage.locator('#btn-submit-rating, #btn-delivered-done').first();
      if (await submitRatingBtn.isVisible()) {
        await submitRatingBtn.click();
      }
      await expect(customerPage.locator('body')).toContainText(/Thank you|रेटिंग देने के लिए धन्यवाद/i);
    }

    // -------------------------------------------------------------
    // Step 6: Admin (Desktop 1440x900) Verifies Delivered Order & Timeline
    // -------------------------------------------------------------
    const { token: adminToken } = await getAdminAuth('owner');
    const adminContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    await adminContext.addCookies([
      {
        name: 'admin_token',
        value: adminToken,
        domain: 'localhost',
        path: '/',
      },
    ]);

    const adminPage = await adminContext.newPage();
    await adminPage.goto('/admin');
    await adminPage.waitForLoadState('networkidle');

    // Find the order row
    const orderRow = adminPage.locator(`tr:has-text("${orderNumber}")`).first();
    await expect(orderRow).toBeVisible({ timeout: 10000 });
    await expect(orderRow).toContainText(/delivered/i);

    // Click into order details
    await orderRow.click();
    const modal = adminPage.locator('#modal-order-detail, .order-detail-container').first();
    await expect(modal).toBeVisible();

    // Verify full timeline includes placed, rider_assigned, buying, out_for_delivery, delivered
    await expect(modal).toContainText(/placed/i);
    await expect(modal).toContainText(/rider assigned|Sunil Kumar/i);
    await expect(modal).toContainText(/delivered/i);

    await customerContext.close();
    await riderContext.close();
    await adminContext.close();
  });
});
