import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApp } from '../../src/server/app.js';
import { createAdminToken, createRiderTokens } from '../../src/server/auth/jwt.js';
import { createSignedUrl, verifySignedUrl } from '../../src/server/routes/uploads.js';
import { orderService, VALID_ORDER_TRANSITIONS } from '../../src/server/services/orderService.js';
import { db } from '../../src/server/db/index.js';
import { orders, auditLogs } from '../../src/server/db/schema.js';
import { eq, desc } from 'drizzle-orm';
import type { Express } from 'express';
import http from 'http';
import fs from 'fs';
import path from 'path';

let app: Express;
let server: http.Server;
let baseUrl: string;

beforeAll(async () => {
  app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const address = server.address() as any;
      baseUrl = `http://localhost:${address.port}`;
      resolve();
    });
  });
});

afterAll(async () => {
  server?.close();
});

describe('STEP 3: Security & Data Integrity Validation', () => {
  /* ==========================================================================
     1. ZOD VALIDATION & FUZZING
     ========================================================================== */
  describe('1. Zod input validation and fuzzing', () => {
    it('rejects empty input on POST /api/v1/orders', async () => {
      const res = await fetch(`${baseUrl}/api/v1/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('VALIDATION_ERROR');
    });

    it('rejects oversized inputs (100k characters) on customer name and address', async () => {
      const hugeName = 'A'.repeat(100000);
      const res = await fetch(`${baseUrl}/api/v1/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: hugeName,
          mobile: '9876543210',
          houseArea: 'Gandhi Chowk',
          pincode: '811307',
          medicines: [{ name: 'Aspirin', quantity: 1 }],
        }),
      });
      // Should either be rejected by payload size or schema
      expect(res.status >= 400).toBe(true);
    });

    it('safely handles unicode and emojis in medicine and customer names', async () => {
      const unicodeName = 'रोहित कुमार 👨‍⚕️ 💊 日本語';
      const res = await fetch(`${baseUrl}/api/v1/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: unicodeName,
          mobile: '9876599901',
          houseArea: 'स्टेशन रोड 🏠 Jamui',
          pincode: '811307',
          medicines: [{ name: 'पैरासिटामोल 500mg 💊', quantity: 2 }],
        }),
      });
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.orderNumber).toMatch(/^ZP-\d+$/);
    });
  });

  /* ==========================================================================
     2. FILE UPLOAD SECURITY
     ========================================================================== */
  describe('2. File upload validation & spoofing defense', () => {
    it('rejects disallowed MIME type (e.g. application/x-sh)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/uploads/presign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: 'script.sh',
          mimeType: 'application/x-sh',
          fileSize: 1024,
        }),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('VALIDATION_ERROR');
    });

    it('rejects spoofed extension (e.g. malware.exe declared as image/jpeg)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/uploads/presign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: 'malware.exe',
          mimeType: 'image/jpeg',
          fileSize: 1024,
        }),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('INVALID_EXTENSION');
      expect(data.message).toContain('does not match');
    });

    it('rejects file size exceeding 8MB', async () => {
      const res = await fetch(`${baseUrl}/api/v1/uploads/presign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: 'huge.jpg',
          mimeType: 'image/jpeg',
          fileSize: 9 * 1024 * 1024, // 9MB
        }),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('VALIDATION_ERROR');
    });

    it('rejects an order containing more than 5 prescription files', async () => {
      const sixFiles = Array.from({ length: 6 }, (_, i) => ({
        fileUrl: `/public/uploads/sample_${i}.jpg`,
        fileType: 'image/jpeg',
        fileSize: 50000,
      }));

      const res = await fetch(`${baseUrl}/api/v1/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Multi Rx Customer',
          mobile: '9876599902',
          houseArea: 'Main Bazaar',
          pincode: '811307',
          prescriptions: sixFiles,
        }),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('VALIDATION_ERROR');
      expect(data.message).toContain('Maximum 5 prescription files allowed');
    });
  });

  /* ==========================================================================
     3. SIGNED URLS & AUDIT LOGS
     ========================================================================== */
  describe('3. Signed URLs expiration & prescription audit logging', () => {
    it('signed URL within 5 minutes succeeds; expired signed URL is rejected with 403', async () => {
      // 1. Create a dummy test file
      const uploadDir = path.join(process.cwd(), 'public', 'uploads');
      const testKey = 'test_signed_file.jpg';
      fs.writeFileSync(path.join(uploadDir, testKey), 'fake image data');

      // 2. Valid signed URL with 5 min (300s) TTL
      const validUrl = createSignedUrl(testKey, 300);
      const resValid = await fetch(`${baseUrl}${validUrl}`);
      expect(resValid.status).toBe(200);

      // 3. Expired signed URL (negative TTL)
      const expiredUrl = createSignedUrl(testKey, -10);
      const resExpired = await fetch(`${baseUrl}${expiredUrl}`);
      expect(resExpired.status).toBe(403);
      const expiredData = await resExpired.json();
      expect(expiredData.error).toBe('URL_EXPIRED');

      // 4. Tampered signature
      const tamperedUrl = validUrl.slice(0, -4) + 'abcd';
      const resTampered = await fetch(`${baseUrl}${tamperedUrl}`);
      expect(resTampered.status).toBe(403);
      const tamperedData = await resTampered.json();
      expect(tamperedData.error).toBe('INVALID_SIGNATURE');

      // Cleanup
      try { fs.unlinkSync(path.join(uploadDir, testKey)); } catch {}
    });

    it('admin viewing a signed prescription URL records an audit_logs entry', async () => {
      const uploadDir = path.join(process.cwd(), 'public', 'uploads');
      const testKey = 'audit_test_prescription.jpg';
      fs.writeFileSync(path.join(uploadDir, testKey), 'prescription bytes');

      const adminToken = await createAdminToken({
        userId: '00000000-0000-0000-0000-000000000001',
        email: 'admin@zupit.in',
        role: 'owner',
      });

      const signedUrl = createSignedUrl(testKey, 300);
      const res = await fetch(`${baseUrl}${signedUrl}`, {
        headers: {
          Cookie: `admin_token=${adminToken}`,
        },
      });
      expect(res.status).toBe(200);

      // Check audit_logs in DB
      const [latestAudit] = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.action, 'prescription_viewed'))
        .orderBy(desc(auditLogs.createdAt))
        .limit(1);

      expect(latestAudit).toBeDefined();
      expect(latestAudit.action).toBe('prescription_viewed');

      // Cleanup
      try { fs.unlinkSync(path.join(uploadDir, testKey)); } catch {}
    });
  });

  /* ==========================================================================
     4. SQL INJECTION DEFENSE
     ========================================================================== */
  describe('4. SQL Injection resistance in search & filters', () => {
    it('handles classic SQL injection strings safely without syntax error or leakage', async () => {
      const adminToken = await createAdminToken({
        userId: '00000000-0000-0000-0000-000000000001',
        email: 'admin@zupit.in',
        role: 'owner',
      });

      const sqliPayloads = [
        "' OR '1'='1",
        "'; DROP TABLE orders; --",
        "1 UNION SELECT null, null, password_hash FROM admins--",
        "1' OR 1=1 #",
      ];

      for (const payload of sqliPayloads) {
        const res = await fetch(`${baseUrl}/api/v1/admin/orders?search=${encodeURIComponent(payload)}`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.success).toBe(true);
        expect(Array.isArray(data.orders)).toBe(true);
      }
    });
  });

  /* ==========================================================================
     5. JWT SECURITY & ROLE MISMATCH
     ========================================================================== */
  describe('5. JWT security: tampered, expired, and wrong-role tokens', () => {
    it('rejects tampered JWT with 401', async () => {
      const validToken = await createAdminToken({
        userId: '00000000-0000-0000-0000-000000000001',
        email: 'admin@zupit.in',
        role: 'owner',
      });
      const tampered = validToken.substring(0, validToken.length - 8) + 'ABCDEFGH';

      const res = await fetch(`${baseUrl}/api/v1/admin/orders`, {
        headers: { Authorization: `Bearer ${tampered}` },
      });
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe('INVALID_TOKEN');
    });

    it('rejects rider JWT when accessing Admin API', async () => {
      const { accessToken: riderToken } = await createRiderTokens({
        userId: '11111111-1111-1111-1111-111111111111',
        phone: '9876543210',
        status: 'approved',
      });

      const res = await fetch(`${baseUrl}/api/v1/admin/orders`, {
        headers: { Authorization: `Bearer ${riderToken}` },
      });
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe('INVALID_TOKEN');
    });
  });

  /* ==========================================================================
     6. CSRF ORIGIN CHECKS ON COOKIE AUTH
     ========================================================================== */
  describe('6. Origin check on cookie-authenticated mutating requests', () => {
    it('blocks mutating POST request with foreign origin when authenticated via cookie', async () => {
      const adminToken = await createAdminToken({
        userId: '00000000-0000-0000-0000-000000000001',
        email: 'admin@zupit.in',
        role: 'owner',
      });

      const res = await fetch(`${baseUrl}/api/v1/admin/orders/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `admin_token=${adminToken}`,
          Origin: 'https://evil-phishing-site.com',
        },
        body: JSON.stringify({
          name: 'Fake',
          mobile: '9876599903',
          houseArea: 'Area',
          pincode: '811307',
          paymentMethod: 'cod',
          medicines: [{ name: 'A', quantity: 1 }],
        }),
      });

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe('CSRF_BLOCKED');
    });
  });

  /* ==========================================================================
     7. RATE LIMITING
     ========================================================================== */
  describe('7. Rate limits on order placement & tracking lookup', () => {
    it('enforces rate limit of 5 orders per hour per phone (6th order rejected)', async () => {
      const testPhone = '9876599999';

      // Submit 5 orders with the same phone
      for (let i = 0; i < 5; i++) {
        const res = await fetch(`${baseUrl}/api/v1/orders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: `Rate Limit Tester ${i}`,
            mobile: testPhone,
            houseArea: 'Main Gate',
            pincode: '811307',
            paymentMethod: 'cod',
            medicines: [{ name: 'Vitamin C', quantity: 1 }],
          }),
        });
        expect(res.status).toBe(201);
      }

      // 6th order should be blocked with 429
      const sixthRes = await fetch(`${baseUrl}/api/v1/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Rate Limit Tester 6',
          mobile: testPhone,
          houseArea: 'Main Gate',
          pincode: '811307',
          paymentMethod: 'cod',
          medicines: [{ name: 'Vitamin C', quantity: 1 }],
        }),
      });

      expect(sixthRes.status).toBe(429);
      const data = await sixthRes.json();
      expect(data.error).toBe('PHONE_RATE_LIMIT_EXCEEDED');
      expect(data.message).toContain('Maximum order limit reached');
    });
  });

  /* ==========================================================================
     8. ORDER STATE MACHINE & IDEMPOTENCY
     ========================================================================== */
  describe('8. State machine transitions & atomic idempotency', () => {
    it('rejects illegal order status transitions via orderService.transition()', async () => {
      // Create a test order
      const orderResult = await orderService.createOrder({
        name: 'State Machine Test',
        phone: '9876599904',
        houseArea: 'Station Road',
        pincode: '811307',
        paymentMethod: 'cod',
        medicines: [{ name: 'Paracetamol', quantity: 1 }],
      });

      // Try transition directly from placed -> delivered (Illegal!)
      await expect(
        orderService.transition(orderResult.orderId, 'delivered', { actorType: 'system' })
      ).rejects.toThrow(/ILLEGAL_TRANSITION/);

      // Legal: placed -> rider_assigned
      const step1 = await orderService.transition(orderResult.orderId, 'rider_assigned', { actorType: 'rider' });
      expect(step1.status).toBe('rider_assigned');

      // Legal: rider_assigned -> buying
      const step2 = await orderService.transition(orderResult.orderId, 'buying', { actorType: 'rider' });
      expect(step2.status).toBe('buying');

      // Illegal: buying -> delivered (Must go through out_for_delivery first)
      await expect(
        orderService.transition(orderResult.orderId, 'delivered', { actorType: 'rider' })
      ).rejects.toThrow(/ILLEGAL_TRANSITION/);
    });

    it('idempotency key deduplicates double-click order creation', async () => {
      const clientKey = 'test_idempotency_' + Date.now();
      const payload = {
        name: 'Idempotency Customer',
        mobile: '9876599905',
        houseArea: 'bypass Road',
        pincode: '811307',
        paymentMethod: 'cod',
        medicines: [{ name: 'Cetirizine 10mg', quantity: 2 }],
        idempotencyKey: clientKey,
      };

      // Send 2 concurrent requests with identical idempotencyKey
      const [res1, res2] = await Promise.all([
        fetch(`${baseUrl}/api/v1/orders`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-idempotency-key': clientKey,
            'x-forwarded-for': '10.0.0.99',
          },
          body: JSON.stringify(payload),
        }),
        fetch(`${baseUrl}/api/v1/orders`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-idempotency-key': clientKey,
            'x-forwarded-for': '10.0.0.99',
          },
          body: JSON.stringify(payload),
        }),
      ]);

      expect(res1.status).toBe(201);
      expect(res2.status).toBe(201);

      const data1 = await res1.json();
      const data2 = await res2.json();

      expect(data1.orderNumber).toBe(data2.orderNumber);
      expect(data1.trackingToken).toBe(data2.trackingToken);

      // Verify in DB that only 1 order exists for this tracking token
      const rows = await db
        .select()
        .from(orders)
        .where(eq(orders.trackingToken, data1.trackingToken));

      expect(rows.length).toBe(1);
    });
  });
});
