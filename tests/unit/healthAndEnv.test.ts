import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createApp } from '../../src/server/app.js';
import { pool } from '../../src/server/db/index.js';
import { validateEnv, envSchema, isExampleSecret } from '../../src/server/env.js';
import http from 'http';
import type { Express } from 'express';

describe('Health Endpoint and Environment Validation', () => {
  let app: Express;
  let server: http.Server;
  let baseUrl: string;

  beforeEach(async () => {
    app = createApp();
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address() as any;
        baseUrl = `http://localhost:${address.port}`;
        resolve();
      });
    });
  });

  afterEach(() => {
    server?.close();
  });

  describe('GET /api/v1/health', () => {
    it('returns 200 with status healthy and database connected when DB is reachable', async () => {
      const res = await fetch(`${baseUrl}/api/v1/health`);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.status).toBe('healthy');
      expect(data.database).toBe('connected');
      expect(data.timestamp).toBeTruthy();
    });

    it('returns 503 with status unhealthy and database disconnected when DB is down', async () => {
      // Mock pool.query to simulate DB outage
      const originalQuery = pool.query.bind(pool);
      vi.spyOn(pool, 'query').mockImplementationOnce(async () => {
        throw new Error('Connection refused: PostgreSQL server is down');
      });

      const res = await fetch(`${baseUrl}/api/v1/health`);
      expect(res.status).toBe(503);

      const data = await res.json();
      expect(data.status).toBe('unhealthy');
      expect(data.database).toBe('disconnected');
      expect(data.error).toContain('Connection refused');
    });
  });

  describe('Express proxy trust setting', () => {
    it('has trust proxy enabled for first reverse proxy hop', () => {
      expect(app.get('trust proxy')).toBe(1);
    });
  });

  describe('Environment Validation and Production Guards (validateEnv)', () => {
    const validBaseEnv = {
      NODE_ENV: 'development',
      PORT: '3002',
      DATABASE_URL: 'postgres://postgres:postgres@localhost:5432/zupit_test',
      JWT_SECRET: 'a_very_long_valid_jwt_secret_with_more_than_32_characters_ok',
      DELIVERY_CODE_SECRET: 'a_very_long_valid_delivery_secret_with_more_than_32_chars_ok',
      SMS_PROVIDER: 'mock',
      ALLOW_MOCK_SMS: 'false',
    };

    it('detects example secrets accurately', () => {
      expect(isExampleSecret('zupit_super_secret_jwt_key_jamui_bihar_2026_secure')).toBe(true);
      expect(isExampleSecret('change_me_in_production_jwt_secret_32chars')).toBe(true);
      expect(isExampleSecret('example_jwt_secret_must_be_changed_at_least_32_chars')).toBe(true);
      expect(isExampleSecret('a98b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f')).toBe(false);
    });

    it('passes development validation with valid variables', () => {
      const validated = validateEnv({ ...validBaseEnv });
      expect(validated.NODE_ENV).toBe('development');
      expect(validated.PORT).toBe(3002);
    });

    it('refuses to start in production if JWT_SECRET is shorter than 32 characters', () => {
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
        throw new Error('process.exit(1) called');
      }) as any);
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        validateEnv({
          ...validBaseEnv,
          NODE_ENV: 'production',
          JWT_SECRET: 'short_secret_under_32',
        });
      }).toThrow('process.exit(1) called');

      expect(exitSpy).toHaveBeenCalledWith(1);
      exitSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it('refuses to start in production if JWT_SECRET equals an example value', () => {
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
        throw new Error('process.exit(1) called');
      }) as any);
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        validateEnv({
          ...validBaseEnv,
          NODE_ENV: 'production',
          JWT_SECRET: 'zupit_super_secret_jwt_key_jamui_bihar_2026_secure',
        });
      }).toThrow('process.exit(1) called');

      expect(exitSpy).toHaveBeenCalledWith(1);
      exitSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it('refuses to start in production if DELIVERY_CODE_SECRET is shorter than 32 characters', () => {
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
        throw new Error('process.exit(1) called');
      }) as any);
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        validateEnv({
          ...validBaseEnv,
          NODE_ENV: 'production',
          DELIVERY_CODE_SECRET: 'short_secret',
        });
      }).toThrow('process.exit(1) called');

      expect(exitSpy).toHaveBeenCalledWith(1);
      exitSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it('refuses to start in production if SMS_PROVIDER=mock and ALLOW_MOCK_SMS is not true', () => {
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
        throw new Error('process.exit(1) called');
      }) as any);
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        validateEnv({
          ...validBaseEnv,
          NODE_ENV: 'production',
          SMS_PROVIDER: 'mock',
          ALLOW_MOCK_SMS: 'false',
        });
      }).toThrow('process.exit(1) called');

      expect(exitSpy).toHaveBeenCalledWith(1);
      exitSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it('allows starting in production if SMS_PROVIDER=mock and ALLOW_MOCK_SMS=true, and prints loud warning', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = validateEnv({
        ...validBaseEnv,
        NODE_ENV: 'production',
        SMS_PROVIDER: 'mock',
        ALLOW_MOCK_SMS: 'true',
      });

      expect(result.NODE_ENV).toBe('production');
      expect(result.ALLOW_MOCK_SMS).toBe(true);
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('allows starting in production with SMS_PROVIDER=msg91 and strong secrets', () => {
      const result = validateEnv({
        ...validBaseEnv,
        NODE_ENV: 'production',
        SMS_PROVIDER: 'msg91',
        MSG91_AUTH_KEY: 'test_msg91_auth_key',
        ALLOW_MOCK_SMS: 'false',
      });

      expect(result.NODE_ENV).toBe('production');
      expect(result.SMS_PROVIDER).toBe('msg91');
    });
  });
});
