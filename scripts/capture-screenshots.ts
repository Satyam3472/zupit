process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/zupit_test';
process.env.PORT = '3003';

import * as dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import { chromium } from '@playwright/test';
import { createApp } from '../src/server/app.js';
import { cleanTestDb, getAdminAuth, getRiderAuth } from '../tests/helpers/testDb.js';

const VIEWPORTS = [
  { name: '360x800', width: 360, height: 800 },
  { name: '390x844', width: 390, height: 844 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '1024x768', width: 1024, height: 768 },
  { name: '1280x720', width: 1280, height: 720 },
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1920x1080', width: 1920, height: 1080 },
  { name: '2560x1440', width: 2560, height: 1440 },
];

const TARGET_DIR = process.argv[2] || 'before';

async function setupTestData() {
  await cleanTestDb();

  // Create order 1 (assigned to rider Sunil)
  const res1 = await fetch('http://localhost:3003/api/v1/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Aakash Verma',
      mobile: '9835129001',
      houseArea: 'Hospital Road, Ward 4',
      pincode: '811307',
      paymentMethod: 'cod',
      medicines: [
        { name: 'Paracetamol 500mg', quantity: 2 },
        { name: 'Azithromycin 500mg', quantity: 1 },
      ],
    }),
  });
  const data1 = await res1.json();
  const order1 = {
    id: data1.orderId,
    orderNumber: data1.orderNumber,
    trackingToken: data1.trackingToken,
  };

  // Sunil accepts order 1
  const { tokens: sunilTokens } = await getRiderAuth('9835123401');
  await fetch(`http://localhost:3003/api/v1/rider/orders/${order1.id}/accept`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sunilTokens.accessToken}`,
    },
  });

  // Create order 2 (unassigned)
  const res2 = await fetch('http://localhost:3003/api/v1/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Pooja Devi',
      mobile: '9835129002',
      houseArea: 'Gandhi Chowk',
      pincode: '811307',
      paymentMethod: 'cod',
      medicines: [{ name: 'Cough Syrup 100ml', quantity: 1 }],
    }),
  });
  const data2 = await res2.json();
  const order2 = {
    id: data2.orderId,
    orderNumber: data2.orderNumber,
    trackingToken: data2.trackingToken,
  };

  const { token: adminToken } = await getAdminAuth('owner');

  return { order1, order2, sunilTokens, adminToken };
}

async function captureViewport(
  browser: any,
  vp: { name: string; width: number; height: number },
  isHindi: boolean,
  testData: any
) {
  const dirName = isHindi ? `${vp.name}-hindi` : vp.name;
  const outDir = path.join(process.cwd(), 'screenshots', TARGET_DIR, dirName);
  fs.mkdirSync(outDir, { recursive: true });

  console.log(`📸 Capturing ${dirName} (${vp.width}x${vp.height})...`);

  // Contexts
  const custContext = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
  });
  const custPage = await custContext.newPage();

  const riderContext = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
  });
  await riderContext.addCookies([
    {
      name: 'rider_access_token',
      value: testData.sunilTokens.accessToken,
      url: 'http://localhost:3003',
    },
  ]);
  const riderPage = await riderContext.newPage();

  const adminContext = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
  });
  await adminContext.addCookies([
    {
      name: 'admin_token',
      value: testData.adminToken,
      url: 'http://localhost:3003',
    },
  ]);
  const adminPage = await adminContext.newPage();

  const anonContext = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
  });
  const anonPage = await anonContext.newPage();

  try {
    // ----------------------------------------------------
    // CUSTOMER APP
    // ----------------------------------------------------
    await custPage.goto('http://localhost:3003/');
    await custPage.waitForLoadState('networkidle');
    if (isHindi) {
      await custPage.evaluate(() => {
        // @ts-ignore
        if (typeof toggleLanguage === 'function') toggleLanguage();
      });
      await custPage.waitForTimeout(200);
    }
    await custPage.screenshot({ path: path.join(outDir, '01_customer_new_order.png') });

    // Order placed
    await custPage.goto('http://localhost:3003/order/placed');
    await custPage.waitForLoadState('networkidle');
    if (isHindi) {
      await custPage.evaluate(() => {
        // @ts-ignore
        if (typeof toggleLanguage === 'function') toggleLanguage();
      });
      await custPage.waitForTimeout(200);
    }
    await custPage.screenshot({ path: path.join(outDir, '02_customer_order_placed.png') });

    // Track Entry
    await custPage.goto('http://localhost:3003/track');
    await custPage.waitForLoadState('networkidle');
    if (isHindi) {
      await custPage.evaluate(() => {
        // @ts-ignore
        if (typeof toggleLanguage === 'function') toggleLanguage();
      });
      await custPage.waitForTimeout(200);
    }
    await custPage.screenshot({ path: path.join(outDir, '03_customer_track_entry.png') });

    // Tracking Screen
    await custPage.goto(`http://localhost:3003/track/${testData.order1.trackingToken}`);
    await custPage.waitForLoadState('networkidle');
    await custPage.waitForTimeout(300);
    if (isHindi) {
      await custPage.evaluate(() => {
        // @ts-ignore
        if (typeof toggleLanguage === 'function') toggleLanguage();
      });
      await custPage.waitForTimeout(200);
    }
    await custPage.screenshot({ path: path.join(outDir, '04_customer_tracking_live.png') });

    // Customer Tracking Bill ready
    await custPage.evaluate(() => {
      // @ts-ignore
      if (typeof setTrackingFrameState === 'function') setTrackingFrameState('bill_cash');
    });
    await custPage.waitForTimeout(200);
    await custPage.screenshot({ path: path.join(outDir, '05_customer_tracking_bill.png') });

    // Customer Delivered
    await custPage.evaluate(() => {
      // @ts-ignore
      if (typeof setTrackingFrameState === 'function') setTrackingFrameState('delivered');
    });
    await custPage.waitForTimeout(200);
    await custPage.screenshot({ path: path.join(outDir, '06_customer_delivered.png') });

    // Help Dialog
    await custPage.evaluate(() => {
      // @ts-ignore
      if (typeof toggleHelpSheet === 'function') toggleHelpSheet(true);
    });
    await custPage.waitForTimeout(200);
    await custPage.screenshot({ path: path.join(outDir, '07_customer_help_dialog.png') });

    // ----------------------------------------------------
    // RIDER APP
    // ----------------------------------------------------
    await anonPage.goto('http://localhost:3003/rider/login');
    await anonPage.waitForLoadState('networkidle');
    if (isHindi) {
      await anonPage.evaluate(() => {
        // @ts-ignore
        if (typeof toggleRiderLang === 'function') toggleRiderLang();
      });
      await anonPage.waitForTimeout(200);
    }
    await anonPage.screenshot({ path: path.join(outDir, '08_rider_login.png') });

    // Rider Dashboard Offline
    await riderPage.goto('http://localhost:3003/rider/dashboard');
    await riderPage.waitForLoadState('networkidle');
    await riderPage.waitForTimeout(300);
    if (isHindi) {
      await riderPage.evaluate(() => {
        // @ts-ignore
        if (typeof toggleRiderLang === 'function') toggleRiderLang();
      });
      await riderPage.waitForTimeout(200);
    }
    await riderPage.screenshot({ path: path.join(outDir, '09_rider_duty_offline.png') });

    // Rider Dashboard Online
    await riderPage.evaluate(() => {
      // @ts-ignore
      if (typeof isDutyOnline !== 'undefined' && !isDutyOnline) toggleDutyStatus();
    });
    await riderPage.waitForTimeout(400);
    await riderPage.screenshot({ path: path.join(outDir, '10_rider_duty_online.png') });

    // Rider Order Detail
    await riderPage.evaluate((id) => {
      // @ts-ignore
      if (typeof viewOrderDetail === 'function') viewOrderDetail(id);
    }, testData.order1.id);
    await riderPage.waitForTimeout(300);
    await riderPage.screenshot({ path: path.join(outDir, '11_rider_order_detail.png') });

    // Rider Buying Checklist
    await riderPage.evaluate(() => {
      // @ts-ignore
      if (typeof navigateTab === 'function') navigateTab('buying');
    });
    await riderPage.waitForTimeout(200);
    await riderPage.screenshot({ path: path.join(outDir, '12_rider_buying.png') });

    // Rider Bill
    await riderPage.evaluate(() => {
      // @ts-ignore
      if (typeof navigateTab === 'function') navigateTab('bill');
    });
    await riderPage.waitForTimeout(200);
    await riderPage.screenshot({ path: path.join(outDir, '13_rider_bill.png') });

    // Rider Delivery
    await riderPage.evaluate(() => {
      // @ts-ignore
      if (typeof navigateTab === 'function') navigateTab('delivery');
    });
    await riderPage.waitForTimeout(200);
    await riderPage.screenshot({ path: path.join(outDir, '14_rider_delivery.png') });

    // Rider Summary
    await riderPage.evaluate(() => {
      // @ts-ignore
      if (typeof navigateTab === 'function') navigateTab('summary');
    });
    await riderPage.waitForTimeout(200);
    await riderPage.screenshot({ path: path.join(outDir, '15_rider_summary.png') });

    // ----------------------------------------------------
    // ADMIN APP
    // ----------------------------------------------------
    await anonPage.goto('http://localhost:3003/admin/login');
    await anonPage.waitForLoadState('networkidle');
    await anonPage.screenshot({ path: path.join(outDir, '16_admin_login.png') });

    // Admin Orders
    await adminPage.goto('http://localhost:3003/admin/dashboard');
    await adminPage.waitForLoadState('networkidle');
    await adminPage.waitForTimeout(400);
    await adminPage.screenshot({ path: path.join(outDir, '17_admin_orders.png') });

    // Admin Order Detail
    await adminPage.evaluate((id) => {
      // @ts-ignore
      if (typeof viewOrderDetail === 'function') viewOrderDetail(id);
    }, testData.order1.id);
    await adminPage.waitForTimeout(300);
    await adminPage.screenshot({ path: path.join(outDir, '18_admin_order_detail.png') });

    // Admin Phone Order
    await adminPage.evaluate(() => {
      // @ts-ignore
      if (typeof setScreen === 'function') setScreen('create-order');
    });
    await adminPage.waitForTimeout(200);
    await adminPage.screenshot({ path: path.join(outDir, '19_admin_create_order.png') });

    // Admin Riders
    await adminPage.evaluate(() => {
      // @ts-ignore
      if (typeof setScreen === 'function') setScreen('riders');
    });
    await adminPage.waitForTimeout(200);
    await adminPage.screenshot({ path: path.join(outDir, '20_admin_riders.png') });

    // Admin Cash
    await adminPage.evaluate(() => {
      // @ts-ignore
      if (typeof setScreen === 'function') setScreen('cash');
    });
    await adminPage.waitForTimeout(200);
    await adminPage.screenshot({ path: path.join(outDir, '21_admin_cash.png') });

    // Admin Customers
    await adminPage.evaluate(() => {
      // @ts-ignore
      if (typeof setScreen === 'function') setScreen('customers');
    });
    await adminPage.waitForTimeout(200);
    await adminPage.screenshot({ path: path.join(outDir, '22_admin_customers.png') });

    // Admin Reports
    await adminPage.evaluate(() => {
      // @ts-ignore
      if (typeof setScreen === 'function') setScreen('reports');
    });
    await adminPage.waitForTimeout(200);
    await adminPage.screenshot({ path: path.join(outDir, '23_admin_reports.png') });

    // Admin Settings
    await adminPage.evaluate(() => {
      // @ts-ignore
      if (typeof setScreen === 'function') setScreen('settings');
    });
    await adminPage.waitForTimeout(200);
    await adminPage.screenshot({ path: path.join(outDir, '24_admin_settings.png') });
  } finally {
    await custContext.close();
    await riderContext.close();
    await adminContext.close();
    await anonContext.close();
  }
}

async function main() {
  const server = createApp().listen(3003);
  console.log('🚀 Server started on port 3003');

  try {
    const testData = await setupTestData();
    const browser = await chromium.launch({ headless: true });

    for (const vp of VIEWPORTS) {
      await captureViewport(browser, vp, false, testData);
      if (vp.name === '360x800' || vp.name === '1280x720') {
        await captureViewport(browser, vp, true, testData);
      }
    }

    await browser.close();
    console.log('🎉 Screenshot capture complete!');
  } finally {
    server.close();
  }
}

main().catch((err) => {
  console.error('Fatal error in capture script:', err);
  process.exit(1);
});
