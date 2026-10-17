import express, { type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import path from 'path';

import authAdminRouter from './routes/authAdmin.js';
import authRiderRouter from './routes/authRider.js';
import riderRouter from './routes/rider.js';
import settingsRouter from './routes/settings.js';
import uploadsRouter from './routes/uploads.js';
import ordersRouter from './routes/orders.js';
import trackRouter from './routes/track.js';
import adminRouter from './routes/admin.js';
import { protectAdminPages, protectRiderPages } from './middleware/auth.js';
import { defaultRateLimiter, InMemoryRateLimiter } from './utils/rateLimit.js';
import { pool } from './db/index.js';

export function createApp() {
  const app = express();

  // Trust first proxy hop (Docker Compose reverse proxy / Caddy / Nginx)
  // Ensures req.ip extracts real client IP and req.secure respects X-Forwarded-Proto
  app.set('trust proxy', 1);

  // Core middleware
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Health check endpoint: checks database connectivity and returns 503 when down
  app.get(['/api/v1/health', '/health'], async (_req: Request, res: Response) => {
    try {
      await pool.query('SELECT 1');
      res.status(200).json({
        status: 'healthy',
        database: 'connected',
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      res.status(503).json({
        status: 'unhealthy',
        database: 'disconnected',
        error: errorMsg,
        timestamp: new Date().toISOString(),
      });
    }
  });

  // CSRF protection: Origin check on cookie-authenticated mutating routes
  app.use((req: Request, res: Response, next) => {
    const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
    const hasAuthCookie = Boolean(req.cookies?.admin_token || req.cookies?.rider_access_token);
    const hasBearerHeader = Boolean(req.headers.authorization && req.headers.authorization.startsWith('Bearer '));

    if (isMutating && hasAuthCookie && !hasBearerHeader) {
      const origin = req.headers.origin;
      const host = req.headers.host;
      if (origin) {
        try {
          const originHost = new URL(origin).host;
          if (originHost !== host && !originHost.startsWith('localhost') && !originHost.startsWith('127.0.0.1')) {
            res.status(403).json({
              success: false,
              error: 'CSRF_BLOCKED',
              message: 'Cross-origin request blocked.',
            });
            return;
          }
        } catch {
          res.status(403).json({ success: false, error: 'INVALID_ORIGIN', message: 'Invalid origin header.' });
          return;
        }
      }
    }
    next();
  });

  const publicDir = path.join(process.cwd(), 'public');
  const rootDir = process.cwd();

  // 1. Specific Login Pages (Unprotected)
  if (process.env.NODE_ENV !== 'production') {
    app.post('/api/v1/test/reset-rate-limits', async (_req: Request, res: Response) => {
      await (defaultRateLimiter as InMemoryRateLimiter).clearAll();
      res.status(200).json({ success: true, message: 'Rate limits cleared for testing.' });
    });
  }
  app.get('/admin/login', (_req: Request, res: Response) => {
    res.sendFile(path.join(publicDir, 'admin-login.html'));
  });

  app.get('/rider/login', (_req: Request, res: Response) => {
    res.sendFile(path.join(publicDir, 'rider-login.html'));
  });

  // 2. Page Guards (Redirects unauthenticated users to login)
  app.use('/admin', protectAdminPages);
  app.use('/rider', protectRiderPages);

  // 3. Protected Dashboard Pages
  app.get(/^\/admin(\/.*)?$/, (_req: Request, res: Response) => {
    res.sendFile(path.join(publicDir, 'admin-dashboard.html'));
  });

  app.get(/^\/rider(\/.*)?$/, (_req: Request, res: Response) => {
    res.sendFile(path.join(publicDir, 'rider-dashboard.html'));
  });

  // 4. REST API Endpoints
  // - Admin auth: /api/v1/admin/auth/login, /api/v1/admin/auth/logout, /api/v1/admin/auth/me
  app.use('/api/v1/admin/auth', authAdminRouter);

  // - Rider auth: /api/v1/rider/auth/request-otp, /api/v1/rider/auth/verify-otp, /api/v1/rider/auth/refresh-token, /api/v1/rider/auth/me
  app.use('/api/v1/rider/auth', authRiderRouter);

  // - Rider Operations: /api/v1/rider/*
  app.use('/api/v1/rider', riderRouter);

  // - Uploads: /api/v1/uploads/presign, /api/v1/uploads/file/:fileKey
  app.use('/api/v1/uploads', uploadsRouter);

  // - Orders: POST /api/v1/orders
  app.use('/api/v1/orders', ordersRouter);

  // - Guest Tracking: /api/v1/track/:token, /api/v1/track/lookup, /api/v1/track/:token/cancel, /api/v1/track/:token/item-decision, /api/v1/track/:token/rating
  app.use('/api/v1/track', trackRouter);

  // - Public config & Admin settings: /api/v1/public/config, /api/v1/admin/settings, /api/v1/admin/audit-logs
  app.use('/api/v1', settingsRouter);

  // - Admin Operations: /api/v1/admin/* (Orders, Riders, Cash, Customers, Reports, Templates)
  app.use('/api/v1/admin', adminRouter);

  // 5. Static Assets (style.css, app.js, index.html)
  app.use('/public', express.static(publicDir));
  app.use(express.static(publicDir));
  app.use(express.static(rootDir));

  // 6. Customer App routes
  app.get(['/', '/order/placed', '/track', '/track/:token'], (_req: Request, res: Response) => {
    res.sendFile(path.join(rootDir, 'index.html'));
  });

  return app;
}
