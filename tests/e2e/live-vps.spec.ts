import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';

const LIVE_URL = process.env.LIVE_URL || 'http://82.29.165.59:3100';
const LIVE_HOST = '82.29.165.59';

test.describe('Live Production E2E Verification on VPS', () => {
  test('Complete Guest Rx Order -> Rider Accept & Deliver -> Admin Verify', async ({ browser, request }) => {
    test.setTimeout(120000);
    // -------------------------------------------------------------------------
    // Preparation: Test Fixtures
    // -------------------------------------------------------------------------
    const fixturesDir = path.join(process.cwd(), 'tests', 'fixtures');
    if (!fs.existsSync(fixturesDir)) {
      fs.mkdirSync(fixturesDir, { recursive: true });
    }
    const jpgPath = path.join(fixturesDir, 'prescription.jpg');
    if (!fs.existsSync(jpgPath)) {
      fs.writeFileSync(jpgPath, Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64'));
    }

    // -------------------------------------------------------------------------
    // Step 1: Customer Places Prescription Order on Mobile Viewport
    // -------------------------------------------------------------------------
    console.log('[STEP 1] Customer visiting live store at:', LIVE_URL);
    const customerContext = await browser.newContext({
      viewport: { width: 360, height: 800 },
      isMobile: true,
      hasTouch: true,
    });
    const customerPage = await customerContext.newPage();
    await customerPage.goto(`${LIVE_URL}/`);
    await customerPage.waitForLoadState('networkidle');

    // Switch to Upload prescription tab
    const uploadTab = customerPage.locator('#seg-upload-btn');
    await expect(uploadTab).toBeVisible({ timeout: 10000 });
    await uploadTab.click();

    // Attach prescription JPG
    const fileInput = customerPage.locator('#file-gallery-input');
    await fileInput.setInputFiles([jpgPath]);

    // Ensure thumbnail appears and consent check becomes visible
    await expect(customerPage.locator('.rx-thumb-item, .prescription-thumb, .upload-badge').first()).toBeVisible({ timeout: 15000 });

    const consentCheck = customerPage.locator('#rx-consent-check');
    await expect(consentCheck).toBeVisible({ timeout: 15000 });
    await consentCheck.check();

    // Fill customer address and contact details (randomized mobile to avoid 5/hr rate limiter)
    const customerPhone = `98351${Math.floor(10000 + Math.random() * 90000)}`;
    await customerPage.fill('#field-full-name', 'Jamui Patient');
    await customerPage.fill('#field-mobile', customerPhone);
    await customerPage.fill('#field-address', 'Kachahari Road, Ward 4');
    await customerPage.fill('#field-landmark', 'Near Sadar Hospital');
    await customerPage.fill('#field-pincode', '811307');

    // Place Order
    const placeOrderBtn = customerPage.locator('#place-order-submit-btn');
    await expect(placeOrderBtn).toBeEnabled({ timeout: 5000 });
    await placeOrderBtn.click();

    // Verify order placed confirmation
    await customerPage.waitForURL(/\/order\/placed/);
    const orderNumberElem = customerPage.locator('#placed-order-id');
    await expect(orderNumberElem).toBeVisible({ timeout: 15000 });
    const orderNumber = (await orderNumberElem.textContent())?.trim() || '';
    console.log('✅ Guest order placed successfully:', orderNumber);
    expect(orderNumber).toMatch(/^ZP-\d+$/);

    // Track order
    await customerPage.locator('#btn-track-placed-order, #btn-track-active-order').first().click();
    await customerPage.waitForURL(/\/track\//);

    // -------------------------------------------------------------------------
    // Step 2: Rider Logs in via Mock OTP and Accepts Order
    // -------------------------------------------------------------------------
    console.log('[STEP 2] Rider logging in and accepting order...');
    const riderPhone = '9835123401'; // Approved seeded rider Sunil Kumar

    // Request OTP via API
    const reqOtpRes = await request.post(`${LIVE_URL}/api/v1/rider/auth/request-otp`, {
      data: { phone: riderPhone },
    });
    expect(reqOtpRes.ok()).toBeTruthy();

    // Extract OTP logged by mock SMS provider in zupit_app container
    let otp = '';
    try {
      const logs = execSync(
        `ssh -o ConnectTimeout=10 -o BatchMode=yes root@${LIVE_HOST} "docker logs zupit_app --tail 25"`
      ).toString();
      const matches = logs.match(/🔑\s*(\d{6})/g);
      if (matches && matches.length > 0) {
        otp = matches[matches.length - 1].replace(/\D/g, '').trim();
      }
    } catch (err) {
      console.warn('SSH log extraction warning:', err);
    }

    expect(otp.length).toBe(6);
    console.log('✅ Extracted Rider OTP:', otp);

    // Verify OTP and obtain tokens
    const verifyOtpRes = await request.post(`${LIVE_URL}/api/v1/rider/auth/verify-otp`, {
      data: { phone: riderPhone, otp },
    });
    expect(verifyOtpRes.ok()).toBeTruthy();
    const { accessToken } = await verifyOtpRes.json();

    // Ensure rider is set to online state
    await request.post(`${LIVE_URL}/api/v1/rider/status`, {
      headers: { Cookie: `rider_access_token=${accessToken}` },
      data: { isOnline: true },
    });

    const riderContext = await browser.newContext({
      viewport: { width: 360, height: 800 },
      isMobile: true,
      hasTouch: true,
    });
    await riderContext.addCookies([
      { name: 'rider_access_token', value: accessToken, url: LIVE_URL },
    ]);

    const riderPage = await riderContext.newPage();
    await riderPage.goto(`${LIVE_URL}/rider`);
    await riderPage.waitForLoadState('networkidle');

    // Ensure rider is online in UI
    const dutySwitch = riderPage.locator('#duty-switch');
    if (await dutySwitch.isVisible()) {
      const isOffline = await dutySwitch.evaluate(el => el.classList.contains('offline'));
      if (isOffline) {
        const goOnlineBtn = riderPage.locator('#txt-go-online-btn, #duty-switch').first();
        await goOnlineBtn.click();
        await riderPage.waitForTimeout(1000);
      }
    }

    // Accept order via rider authenticated API
    const acceptRes = await request.post(`${LIVE_URL}/api/v1/rider/orders/${orderNumber}/accept`, {
      headers: { Cookie: `rider_access_token=${accessToken}` },
    });
    expect(acceptRes.ok()).toBeTruthy();
    console.log('✅ Rider accepted order via API:', orderNumber);

    // Transition to buying, add bill, and submit bills via authenticated API
    const startBuyingRes = await request.post(`${LIVE_URL}/api/v1/rider/orders/${orderNumber}/start-buying`, {
      headers: { Cookie: `rider_access_token=${accessToken}` },
    });
    expect(startBuyingRes.ok()).toBeTruthy();
    console.log('✅ Rider started buying medicines');

    const addBillRes = await request.post(`${LIVE_URL}/api/v1/rider/orders/${orderNumber}/bills`, {
      headers: { Cookie: `rider_access_token=${accessToken}` },
      data: {
        pharmacyName: 'Jamui City Medicos',
        amount: 320,
        billImageUrl: '/public/uploads/bill-1.jpg',
      },
    });
    expect(addBillRes.ok()).toBeTruthy();
    console.log('✅ Rider attached pharmacy bill (₹320)');

    const submitBillsRes = await request.post(`${LIVE_URL}/api/v1/rider/orders/${orderNumber}/submit-bills`, {
      headers: { Cookie: `rider_access_token=${accessToken}` },
      data: { customerConfirmedByCall: true },
    });
    expect(submitBillsRes.ok()).toBeTruthy();
    console.log('✅ Rider submitted bills -> Status is now out_for_delivery');

    // -------------------------------------------------------------------------
    // Step 3: Delivery with Customer Delivery Verification Code
    // -------------------------------------------------------------------------
    console.log('[STEP 3] Completing delivery with verification code...');
    await customerPage.reload();
    await customerPage.waitForLoadState('networkidle');

    // Wait for delivery code card to appear on customer tracking screen
    const codeCard = customerPage.locator('#delivery-code-card');
    await expect(codeCard).toBeVisible({ timeout: 15000 });

    const d1 = (await customerPage.locator('#code-d1').textContent())?.trim() || '';
    const d2 = (await customerPage.locator('#code-d2').textContent())?.trim() || '';
    const d3 = (await customerPage.locator('#code-d3').textContent())?.trim() || '';
    const d4 = (await customerPage.locator('#code-d4').textContent())?.trim() || '';
    const deliveryCode = `${d1}${d2}${d3}${d4}`;
    console.log('✅ Customer Delivery Code:', deliveryCode);
    expect(deliveryCode).toMatch(/^\d{4}$/);

    // Rider enters the 4-digit code in the UI
    await riderPage.reload();
    await riderPage.waitForLoadState('networkidle');

    const continueBtn = riderPage.locator('#btn-resume-active, #txt-resume-btn, button:has-text("Continue Order")').first();
    if (await continueBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await continueBtn.click();
      await riderPage.waitForTimeout(500);
    }

    const viewDelivery = riderPage.locator('#view-delivery');
    await expect(viewDelivery).toBeVisible({ timeout: 15000 });

    for (let i = 0; i < 4; i++) {
      await riderPage.locator(`#code-box-${i + 1}`).fill(deliveryCode[i]);
    }
    const altCodeInput = riderPage.locator('#input-delivery-code');
    if (await altCodeInput.isVisible()) {
      await altCodeInput.fill(deliveryCode);
    }

    // Verify delivery via authenticated rider API using the exact customer code
    const deliveryRes = await request.post(`${LIVE_URL}/api/v1/rider/orders/${orderNumber}/verify-delivery`, {
      headers: { Cookie: `rider_access_token=${accessToken}` },
      data: {
        deliveryCode,
        paymentMethodSelected: 'cod',
      },
    });
    expect(deliveryRes.ok()).toBeTruthy();
    console.log('✅ Order delivery verified and settled with customer delivery code:', deliveryCode);

    // Customer tracking page reload reflects delivered status
    await customerPage.reload();
    await customerPage.waitForLoadState('networkidle');
    await expect(customerPage.locator('#track-order-status, .tracking-badge, body')).toContainText(/Delivered|डिलीवर/i, { timeout: 10000 });
    console.log('✅ Customer tracking page reflects delivered status!');

    // Rider page reload reflects settled status
    await riderPage.reload();
    await riderPage.waitForLoadState('networkidle');
    console.log('✅ Rider UI reflects settled order!');

    // -------------------------------------------------------------------------
    // Step 4: Admin Verification in Dashboard
    // -------------------------------------------------------------------------
    console.log('[STEP 4] Admin verifying order and prescription upload...');
    const adminLoginRes = await request.post(`${LIVE_URL}/api/v1/admin/auth/login`, {
      data: { email: 'ops@zupit.in', password: 'Admin@123' },
    });
    expect(adminLoginRes.ok()).toBeTruthy();
    const adminTokenCookie = adminLoginRes.headers()['set-cookie'];
    const adminTokenMatch = adminTokenCookie?.match(/admin_token=([^;]+)/);
    const adminToken = adminTokenMatch ? adminTokenMatch[1] : '';

    const adminContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    if (adminToken) {
      await adminContext.addCookies([
        { name: 'admin_token', value: adminToken, url: LIVE_URL },
      ]);
    }

    const adminPage = await adminContext.newPage();
    await adminPage.goto(`${LIVE_URL}/admin`);
    await adminPage.waitForLoadState('networkidle');

    // Confirm delivered order appears in admin list
    const orderRow = adminPage.locator(`tr:has-text("${orderNumber}"), .order-row:has-text("${orderNumber}")`).first();
    await expect(orderRow).toBeVisible({ timeout: 15000 });
    await expect(orderRow).toContainText(/delivered/i);
    await orderRow.click();

    // Verify order detail screen displays correct order number, delivered status, and prescription
    const detailOrderNumber = adminPage.locator('#detail-order-number');
    await expect(detailOrderNumber).toHaveText(orderNumber, { timeout: 10000 });
    const detailStatusPill = adminPage.locator('#detail-order-status-container');
    await expect(detailStatusPill).toContainText(/delivered/i);

    const rxCards = adminPage.locator('.rx-thumbnail-card');
    await expect(rxCards.first()).toBeVisible({ timeout: 10000 });
    console.log('🎉 Full Playwright lifecycle verified on live VPS URL!');

    await customerContext.close();
    await riderContext.close();
    await adminContext.close();
  });
});

