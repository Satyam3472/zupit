import { describe, it, expect, beforeAll } from 'vitest';
import { settingsService } from '../../src/server/services/settingsService.js';
import { createAdminToken, createRiderTokens } from '../../src/server/auth/jwt.js';
import { createApp } from '../../src/server/app.js';
import type { Express } from 'express';
import http from 'http';

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
  return () => {
    server.close();
  };
});

describe('STEP 0: Settings & Payments Off Verification', () => {
  it('default settings should have payments_enabled as false', async () => {
    const all = await settingsService.getAll();
    expect(all).toHaveProperty('payments_enabled');
    expect(all.payments_enabled).toBe(false);
  });

  it('GET /api/v1/public/config exposes payments_enabled and hides private keys', async () => {
    const res = await fetch(`${baseUrl}/api/v1/public/config`);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.config).toHaveProperty('payments_enabled', false);
    expect(data.config).toHaveProperty('cod_enabled');
    expect(data.config).toHaveProperty('delivery_fee');

    // Security: private keys must NEVER leak in public config
    expect(data.config).not.toHaveProperty('jwt_secret');
    expect(data.config).not.toHaveProperty('msg91_auth_key');
    expect(data.config).not.toHaveProperty('database_url');
  });

  it('rejects order with payment_method = "online" when payments_enabled is false', async () => {
    const res = await fetch(`${baseUrl}/api/v1/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Customer',
        mobile: '9876500001',
        houseArea: 'Gandhi Nagar',
        pincode: '811307',
        paymentMethod: 'online',
        medicines: [{ name: 'Paracetamol 500mg', quantity: 1 }],
      }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe('ONLINE_PAYMENTS_DISABLED');
    expect(data.message).toContain('Online payments are currently disabled');
  });

  it('Ops role cannot edit settings (403 FORBIDDEN), Owner role can edit', async () => {
    const opsToken = await createAdminToken({
      userId: '00000000-0000-0000-0000-000000000002',
      email: 'ops@zupit.in',
      role: 'ops',
    });

    const ownerToken = await createAdminToken({
      userId: '00000000-0000-0000-0000-000000000001',
      email: 'admin@zupit.in',
      role: 'owner',
    });

    // Ops attempt -> 403
    const opsRes = await fetch(`${baseUrl}/api/v1/admin/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${opsToken}`,
      },
      body: JSON.stringify({ delivery_fee: 30 }),
    });
    expect(opsRes.status).toBe(403);
    const opsData = await opsRes.json();
    expect(opsData.error).toBe('FORBIDDEN');

    // Owner attempt -> 200
    const ownerRes = await fetch(`${baseUrl}/api/v1/admin/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({ delivery_fee: 25 }),
    });
    expect(ownerRes.status).toBe(200);
  });
});
