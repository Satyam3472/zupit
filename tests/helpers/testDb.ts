import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../../src/server/db/schema.js';
import { createAdminToken, createRiderTokens } from '../../src/server/auth/jwt.js';
import { eq } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

export const TEST_DB_URL = 'postgres://postgres:postgres@localhost:5432/zupit_test';

export const testPool = new Pool({
  connectionString: TEST_DB_URL,
});

export const testDb = drizzle(testPool, { schema });

/**
 * Fast transactional tables truncation between journeys (< 50ms)
 */
export async function cleanTestDb() {
  const client = await testPool.connect();
  try {
    await client.query(`
      TRUNCATE TABLE 
        order_status_events,
        order_ratings,
        rider_cash_ledger,
        payments,
        bills,
        prescriptions,
        order_items,
        orders,
        addresses,
        customers,
        audit_logs,
        otp_codes
      CASCADE;
      ALTER SEQUENCE order_number_seq RESTART WITH 10001;
    `);

    // Reset rider balances to 0.00
    await client.query(`
      UPDATE riders 
      SET cash_balance = '0.00', 
          status = CASE WHEN phone = '9835123499' THEN 'pending_approval'::rider_status ELSE 'approved'::rider_status END;
    `);

    // Ensure payments_enabled is false and delivery_fee is 25
    await client.query(`
      UPDATE settings SET value = 'false' WHERE key = 'payments_enabled';
      UPDATE settings SET value = '25' WHERE key = 'delivery_fee';
    `);

    // Reset in-memory rate limits on test server if running
    await fetch('http://localhost:3003/api/v1/test/reset-rate-limits', { method: 'POST' }).catch(() => {});
  } finally {
    client.release();
  }
}

/**
 * Retrieves or creates admin token for Playwright browser context
 */
export async function getAdminAuth(role: 'owner' | 'ops' = 'owner') {
  const [admin] = await testDb
    .select()
    .from(schema.admins)
    .where(eq(schema.admins.role, role))
    .limit(1);

  if (!admin) {
    throw new Error(`Admin with role ${role} not found in test database`);
  }

  const token = await createAdminToken({
    id: admin.id,
    email: admin.email,
    role: admin.role,
  });

  return { admin, token };
}

/**
 * Retrieves rider and creates JWT tokens for Playwright browser context
 */
export async function getRiderAuth(phone: string = '9835123401') {
  const [rider] = await testDb
    .select()
    .from(schema.riders)
    .where(eq(schema.riders.phone, phone))
    .limit(1);

  if (!rider) {
    throw new Error(`Rider with phone ${phone} not found in test database`);
  }

  const tokens = await createRiderTokens({
    id: rider.id,
    phone: rider.phone,
    name: rider.name,
  });

  return { rider, tokens };
}

/**
 * Creates dummy sample prescription files for tests
 */
export function ensureTestFixtures() {
  const fixturesDir = path.join(process.cwd(), 'tests', 'fixtures');
  if (!fs.existsSync(fixturesDir)) {
    fs.mkdirSync(fixturesDir, { recursive: true });
  }

  const jpgPath = path.join(fixturesDir, 'prescription.jpg');
  if (!fs.existsSync(jpgPath)) {
    // 1x1 dummy jpg header
    const dummyJpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xd9]);
    fs.writeFileSync(jpgPath, dummyJpg);
  }

  const pdfPath = path.join(fixturesDir, 'prescription.pdf');
  if (!fs.existsSync(pdfPath)) {
    const dummyPdf = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000052 00000 n\n0000000101 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n162\n%%EOF');
    fs.writeFileSync(pdfPath, dummyPdf);
  }

  return { jpgPath, pdfPath };
}
