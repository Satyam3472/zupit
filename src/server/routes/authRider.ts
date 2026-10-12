import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import argon2 from 'argon2';
import { db } from '../db/index.js';
import { riders, otpCodes } from '../db/schema.js';
import { eq, and, desc, gt } from 'drizzle-orm';
import { createRiderTokens, verifyRiderRefreshToken } from '../auth/jwt.js';
import { smsProvider } from '../sms/index.js';
import { rateLimit } from '../utils/rateLimit.js';
import { auditService } from '../services/auditService.js';
import { requireRiderApi } from '../middleware/auth.js';

const router = Router();

const RequestOtpSchema = z.object({
  phone: z.string().transform((v) => v.replace(/\D/g, '').slice(-10)),
});

const VerifyOtpSchema = z.object({
  phone: z.string().transform((v) => v.replace(/\D/g, '').slice(-10)),
  otp: z.string().length(6, 'OTP must be 6 digits'),
});

const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(10),
});

/**
 * POST /api/v1/rider/auth/request-otp
 * Only riders with status 'approved' can log in.
 * OTP is 6 digits, expires in 5 minutes, stored hashed, 5 attempts max.
 */
router.post('/request-otp', async (req: Request, res: Response): Promise<void> => {
  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

  const parsed = RequestOtpSchema.safeParse(req.body);
  if (!parsed.success || parsed.data.phone.length !== 10) {
    res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'Please provide a valid 10-digit mobile number.',
    });
    return;
  }

  const phone = parsed.data.phone;

  // Rate limit: 5 requests per 10 minutes per phone
  const rl = await rateLimit(`rider_otp_req:${phone}`, 5, 600);
  if (!rl.success) {
    res.status(429).json({
      success: false,
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many OTP requests for this phone. Please wait a few minutes.',
      resetTime: rl.resetTime,
    });
    return;
  }

  // Look up rider in database
  const [rider] = await db
    .select()
    .from(riders)
    .where(eq(riders.phone, phone))
    .limit(1);

  if (!rider) {
    res.status(404).json({
      success: false,
      error: 'RIDER_NOT_FOUND',
      status: 'not_registered',
      message: 'No rider profile found with this phone number. Please contact the Jamui hub admin.',
    });
    return;
  }

  // State checks: ONLY approved riders can log in
  if (rider.status === 'pending_approval') {
    res.status(403).json({
      success: false,
      error: 'WAITING_FOR_APPROVAL',
      status: 'pending_approval',
      message: 'Your rider account is waiting for approval by the Jamui hub ops team.',
      supportPhone: '+91 62078 56200',
    });
    return;
  }

  if (rider.status === 'blocked') {
    res.status(403).json({
      success: false,
      error: 'RIDER_BLOCKED',
      status: 'blocked',
      message: 'Your rider account has been blocked. Please contact Jamui support.',
      supportPhone: '+91 62078 56200',
    });
    return;
  }

  // Generate 6-digit OTP
  const rawOtp = Math.floor(100000 + Math.random() * 900000).toString();

  // Hash the OTP with argon2 for secure storage
  const hashedOtp = await argon2.hash(rawOtp);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  // Insert into otp_codes
  await db.insert(otpCodes).values({
    phone,
    code: hashedOtp,
    purpose: 'rider_login',
    attempts: 0,
    isVerified: false,
    expiresAt,
  });

  // Dispatch OTP via active SMS provider
  await smsProvider.sendOtp(phone, rawOtp);

    res.status(200).json({
      success: true,
      message: '6-digit OTP sent successfully. Valid for 5 minutes.',
      status: 'otp_sent',
      expiresInSeconds: 300,
      resendAvailableInSeconds: 30,
      devOtp: process.env.NODE_ENV !== 'production' ? rawOtp : undefined,
    });
  });

/**
 * POST /api/v1/rider/auth/verify-otp
 * Verifies 6-digit hashed OTP, max 5 attempts. Returns access token (15m) & refresh token (30d).
 */
router.post('/verify-otp', async (req: Request, res: Response): Promise<void> => {
  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

  const parsed = VerifyOtpSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'Invalid phone or 6-digit OTP format.',
    });
    return;
  }

  const { phone, otp } = parsed.data;

  // Retrieve the latest non-verified OTP for this phone within expiry
  const now = new Date();
  const [activeOtp] = await db
    .select()
    .from(otpCodes)
    .where(
      and(
        eq(otpCodes.phone, phone),
        eq(otpCodes.purpose, 'rider_login'),
        eq(otpCodes.isVerified, false),
        gt(otpCodes.expiresAt, now)
      )
    )
    .orderBy(desc(otpCodes.createdAt))
    .limit(1);

  if (!activeOtp) {
    res.status(400).json({
      success: false,
      error: 'OTP_EXPIRED_OR_NOT_FOUND',
      message: 'OTP has expired or was not requested. Please tap Resend OTP.',
    });
    return;
  }

  // Check 5 attempts maximum rule
  if (activeOtp.attempts >= 5) {
    res.status(429).json({
      success: false,
      error: 'MAX_ATTEMPTS_EXCEEDED',
      message: 'Maximum 5 attempts reached. This OTP is now invalid. Request a new OTP.',
    });
    return;
  }

  // Increment attempts count
  const newAttempts = activeOtp.attempts + 1;
  await db
    .update(otpCodes)
    .set({ attempts: newAttempts, updatedAt: new Date() })
    .where(eq(otpCodes.id, activeOtp.id));

  // Verify argon2 hash
  const isValid = await argon2.verify(activeOtp.code, otp);
  if (!isValid) {
    const remaining = Math.max(0, 5 - newAttempts);
    res.status(400).json({
      success: false,
      error: 'INVALID_OTP',
      message: `Incorrect OTP. ${remaining} attempt(s) remaining.`,
      attemptsRemaining: remaining,
    });
    return;
  }

  // Mark OTP verified
  await db
    .update(otpCodes)
    .set({ isVerified: true, updatedAt: new Date() })
    .where(eq(otpCodes.id, activeOtp.id));

  // Confirm rider exists and is approved
  const [rider] = await db
    .select()
    .from(riders)
    .where(eq(riders.phone, phone))
    .limit(1);

  if (!rider || rider.status !== 'approved') {
    res.status(403).json({
      success: false,
      error: 'RIDER_NOT_APPROVED',
      message: 'Rider is not approved for active duty.',
    });
    return;
  }

  // Issue tokens: 15-minute access token and 30-day refresh token
  const { accessToken, refreshToken } = await createRiderTokens({
    id: rider.id,
    phone: rider.phone,
    name: rider.name,
  });

  // Set HTTP-only cookie for browser clients
  res.cookie('rider_access_token', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 15 * 60 * 1000, // 15 mins
    path: '/',
  });

  // Record audit log
  await auditService.log(
    { actorType: 'rider', actorId: rider.id, ipAddress: clientIp },
    'rider_logged_in_otp',
    { type: 'rider', id: rider.id },
    { phone: rider.phone, vehicleNumber: rider.vehicleNumber }
  );

  res.status(200).json({
    success: true,
    message: 'OTP verified successfully.',
    accessToken,
    refreshToken,
    rider: {
      id: rider.id,
      name: rider.name,
      phone: rider.phone,
      vehicleType: rider.vehicleType,
      vehicleNumber: rider.vehicleNumber,
      cashBalance: rider.cashBalance,
      status: rider.status,
    },
  });
});

/**
 * POST /api/v1/rider/auth/refresh-token
 * Accepts 30-day refresh token, issues fresh 15-minute access token.
 */
router.post('/refresh-token', async (req: Request, res: Response): Promise<void> => {
  const parsed = RefreshTokenSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'Please provide a valid refresh token.',
    });
    return;
  }

  const payload = await verifyRiderRefreshToken(parsed.data.refreshToken);
  if (!payload) {
    res.status(401).json({
      success: false,
      error: 'INVALID_REFRESH_TOKEN',
      message: 'Refresh token expired or invalid. Please log in again with OTP.',
    });
    return;
  }

  // Confirm rider is still active/approved
  const [rider] = await db
    .select()
    .from(riders)
    .where(eq(riders.id, payload.userId))
    .limit(1);

  if (!rider || rider.status !== 'approved') {
    res.status(403).json({
      success: false,
      error: 'RIDER_SUSPENDED',
      message: 'Rider account is no longer approved.',
    });
    return;
  }

  // Issue new 15-minute access token and new refresh token
  const tokens = await createRiderTokens({
    id: rider.id,
    phone: rider.phone,
    name: rider.name,
  });

  res.cookie('rider_access_token', tokens.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 15 * 60 * 1000,
    path: '/',
  });

  res.status(200).json({
    success: true,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  });
});

/**
 * GET /api/v1/rider/auth/me
 */
router.get('/me', requireRiderApi, async (req: Request, res: Response): Promise<void> => {
  if (!req.rider) {
    res.status(401).json({ success: false, message: 'Unauthorized' });
    return;
  }

  const [rider] = await db
    .select({
      id: riders.id,
      name: riders.name,
      phone: riders.phone,
      vehicleType: riders.vehicleType,
      vehicleNumber: riders.vehicleNumber,
      cashBalance: riders.cashBalance,
      status: riders.status,
    })
    .from(riders)
    .where(eq(riders.id, req.rider.userId))
    .limit(1);

  if (!rider) {
    res.status(404).json({ success: false, message: 'Rider not found' });
    return;
  }

  res.status(200).json({ success: true, rider });
});

export default router;
