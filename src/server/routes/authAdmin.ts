import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import argon2 from 'argon2';
import { db } from '../db/index.js';
import { admins } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { createAdminToken } from '../auth/jwt.js';
import { rateLimit } from '../utils/rateLimit.js';
import { auditService } from '../services/auditService.js';
import { requireAdminApi } from '../middleware/auth.js';

const router = Router();

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * POST /api/v1/admin/auth/login
 * Rate limit: 5 attempts per minute per IP
 */
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
  const rateLimitKey = `admin_login:${clientIp}`;

  // Enforce 5 attempts per minute per IP
  const rl = await rateLimit(rateLimitKey, 5, 60);
  if (!rl.success) {
    res.status(429).json({
      success: false,
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many login attempts. Please wait 1 minute before trying again.',
      resetTime: rl.resetTime,
    });
    return;
  }

  // Validate input schema
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'Invalid email or password format.',
      details: parsed.error.format(),
    });
    return;
  }

  const { email, password } = parsed.data;

  // Find admin by email
  const [admin] = await db
    .select()
    .from(admins)
    .where(eq(admins.email, email.toLowerCase().trim()))
    .limit(1);

  if (!admin || !admin.passwordHash) {
    res.status(401).json({
      success: false,
      error: 'INVALID_CREDENTIALS',
      message: 'Invalid email or password.',
      remainingAttempts: rl.remaining,
    });
    return;
  }

  if (!admin.isActive) {
    res.status(403).json({
      success: false,
      error: 'ACCOUNT_DISABLED',
      message: 'This admin account has been deactivated. Contact the Jamui hub owner.',
    });
    return;
  }

  // Verify argon2 password hash
  const isValidPassword = await argon2.verify(admin.passwordHash, password);
  if (!isValidPassword) {
    res.status(401).json({
      success: false,
      error: 'INVALID_CREDENTIALS',
      message: 'Invalid email or password.',
      remainingAttempts: rl.remaining,
    });
    return;
  }

  // Issue 8-hour JWT
  const token = await createAdminToken({
    id: admin.id,
    email: admin.email,
    role: admin.role,
  });

  const isSecure = process.env.COOKIE_SECURE !== undefined ? process.env.COOKIE_SECURE === 'true' : process.env.NODE_ENV === 'production';

  // Set HTTP-only cookie
  res.cookie('admin_token', token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000, // 8 hours in ms
    path: '/',
  });

  // Record audit log
  await auditService.log(
    { actorType: 'admin', actorId: admin.id, ipAddress: clientIp },
    'admin_logged_in',
    { type: 'admin', id: admin.id },
    { email: admin.email, role: admin.role }
  );

  res.status(200).json({
    success: true,
    message: 'Login successful',
    token,
    admin: {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
    },
  });
});

/**
 * POST /api/v1/admin/auth/logout
 */
router.post('/logout', async (req: Request, res: Response): Promise<void> => {
  res.clearCookie('admin_token', { path: '/' });
  res.status(200).json({
    success: true,
    message: 'Logged out successfully.',
  });
});

/**
 * GET /api/v1/admin/auth/me
 */
router.get('/me', requireAdminApi, async (req: Request, res: Response): Promise<void> => {
  if (!req.admin) {
    res.status(401).json({ success: false, message: 'Unauthorized' });
    return;
  }

  const [admin] = await db
    .select({
      id: admins.id,
      name: admins.name,
      email: admins.email,
      role: admins.role,
      phone: admins.phone,
    })
    .from(admins)
    .where(eq(admins.id, req.admin.userId))
    .limit(1);

  if (!admin) {
    res.status(404).json({ success: false, message: 'Admin not found' });
    return;
  }

  res.status(200).json({
    success: true,
    admin,
  });
});

export default router;
