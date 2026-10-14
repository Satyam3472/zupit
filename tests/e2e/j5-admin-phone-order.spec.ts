import { test, expect } from '@playwright/test';
import { cleanTestDb, getAdminAuth, getRiderAuth } from '../helpers/testDb.js';

test.describe('J5: Admin Phone Order & Rider Assignment / Reassignment', () => {
  test.beforeEach(async () => {
    await cleanTestDb();
  });

  test('Admin creates phone order for new and existing customer, assigns and reassigns rider', async ({ browser }) => {
    const { token: adminToken } = await getAdminAuth('owner');
    const { rider: rider1 } = await getRiderAuth('9835123401');
    const { rider: rider2 } = await getRiderAuth('9835123402');

    const adminContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    await adminContext.addCookies([
      { name: 'admin_token', value: adminToken, domain: 'localhost', path: '/' },
    ]);

    const page = await adminContext.newPage();
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    // -------------------------------------------------------------
    // Step 1: Admin Creates Phone Order for a NEW Customer
    // -------------------------------------------------------------
    await page.click('#btn-header-create-order');
    await expect(page.locator('#screen-create-order')).toBeVisible();

    // Select source Phone
    await page.selectOption('#co-source', 'phone');

    // Fill new customer details
    await page.fill('#co-phone', '9835129031');
    await page.fill('#co-name', 'Rajnish Kumar');
    await page.fill('#co-address', 'Station Road, Shop #12');
    await page.fill('#co-landmark', 'Near SBI ATM');
    await page.fill('#co-pincode', '811307');

    // Fill medicine row
    const firstMedName = page.locator('.co-med-name').first();
    await firstMedName.fill('Dolo 650mg');
    const firstMedQty = page.locator('.co-med-qty').first();
    await firstMedQty.fill('2');

    // Submit phone order
    await page.click('#btn-submit-create-order');

    // Order creation transitions to detail screen
    await expect(page.locator('#screen-order-detail')).toBeVisible({ timeout: 10000 });

    // -------------------------------------------------------------
    // Step 2: Manually Assign Rider 1 (Sunil Kumar)
    // -------------------------------------------------------------
    // Tap Assign Rider
    await page.locator('#btn-assign-rider-now, #btn-detail-reassign').first().click();
    await expect(page.locator('#modal-assign-rider')).toBeVisible();

    // Select Rider 1 radio
    await page.check(`input[name="assign_rider_radio"][value="${rider1.id}"]`);
    await page.click('#btn-confirm-assign-rider');

    // Verify modal closes and assigned rider is Sunil Kumar
    await expect(page.locator('#screen-order-detail')).toContainText(/Sunil Kumar/i, { timeout: 10000 });

    // -------------------------------------------------------------
    // Step 3: Reassign to Rider 2 (Amit Sharma)
    // -------------------------------------------------------------
    await page.locator('#btn-reassign-quick, #btn-detail-reassign').first().click();
    await expect(page.locator('#modal-assign-rider')).toBeVisible();

    // Select Rider 2 radio
    await page.check(`input[name="assign_rider_radio"][value="${rider2.id}"]`);
    await page.click('#btn-confirm-assign-rider');

    // Verify assigned rider updated to Amit Sharma
    await expect(page.locator('#screen-order-detail')).toContainText(/Amit Sharma/i, { timeout: 10000 });
    // Verify timeline records reassignment
    await expect(page.locator('#screen-order-detail')).toContainText(/reassigned/i);

    // Return to orders list
    await page.click('#btn-back-to-orders');
    await expect(page.locator('#screen-orders')).toBeVisible({ timeout: 10000 });
    const orderRow1 = page.locator('tr:has-text("Rajnish Kumar")').first();
    await expect(orderRow1).toBeVisible({ timeout: 10000 });

    // -------------------------------------------------------------
    // Step 4: Admin Creates Second Phone Order for EXISTING Customer
    // -------------------------------------------------------------
    await page.click('#btn-header-create-order');
    await expect(page.locator('#screen-create-order')).toBeVisible();

    await page.selectOption('#co-source', 'phone');
    // Type existing customer phone to trigger lookup
    await page.fill('#co-phone', '9835129031');
    await page.locator('#co-phone').dispatchEvent('input');

    // Wait a brief moment for customer lookup autofill
    await page.waitForTimeout(500);

    // Fill medicine & place second order
    await page.fill('.co-med-name', 'Azithral 500mg');
    await page.click('#btn-submit-create-order');

    await expect(page.locator('#screen-order-detail')).toBeVisible({ timeout: 10000 });
    await page.click('#btn-back-to-orders');

    await expect(page.locator('#screen-orders')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('tr:has-text("Rajnish Kumar")').nth(1)).toBeVisible({ timeout: 10000 });

    await adminContext.close();
  });
});
