import express, { type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import path from 'path';

import authAdminRouter from './routes/authAdmin.js';
import authRiderRouter from './routes/authRider.js';
import settingsRouter from './routes/settings.js';
import uploadsRouter from './routes/uploads.js';
import ordersRouter from './routes/orders.js';
import { protectAdminPages, protectRiderPages } from './middleware/auth.js';

export function createApp() {
  const app = express();

  // Core middleware
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  const publicDir = path.join(process.cwd(), 'public');
  const rootDir = process.cwd();

  // 1. Specific Login Pages (Unprotected)
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
  app.get(['/admin', '/admin/dashboard'], (_req: Request, res: Response) => {
    res.sendFile(path.join(publicDir, 'admin-dashboard.html'));
  });

  app.get(['/rider', '/rider/dashboard'], (_req: Request, res: Response) => {
    res.sendFile(path.join(publicDir, 'rider-dashboard.html'));
  });

  // 4. REST API Endpoints
  // - Admin auth: /api/v1/admin/auth/login, /api/v1/admin/auth/logout, /api/v1/admin/auth/me
  app.use('/api/v1/admin/auth', authAdminRouter);

  // - Rider auth: /api/v1/rider/auth/request-otp, /api/v1/rider/auth/verify-otp, /api/v1/rider/auth/refresh-token, /api/v1/rider/auth/me
  app.use('/api/v1/rider/auth', authRiderRouter);

  // - Uploads: /api/v1/uploads/presign, /api/v1/uploads/file/:fileKey
  app.use('/api/v1/uploads', uploadsRouter);

  // - Orders: POST /api/v1/orders, GET /api/v1/orders/track/:trackingToken
  app.use('/api/v1/orders', ordersRouter);

  // - Public config & Admin settings: /api/v1/public/config, /api/v1/admin/settings, /api/v1/admin/audit-logs
  app.use('/api/v1', settingsRouter);

  // 5. Static Assets (style.css, app.js, index.html)
  app.use('/public', express.static(publicDir));
  app.use(express.static(rootDir));

  // 6. Customer App routes
  app.get(['/', '/order/placed'], (_req: Request, res: Response) => {
    res.sendFile(path.join(rootDir, 'index.html'));
  });

  return app;
}
