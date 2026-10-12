import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { rateLimit } from '../utils/rateLimit.js';
import { auditService } from '../services/auditService.js';
import { verifyAdminToken } from '../auth/jwt.js';

const router = Router();

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/jpg',
  'application/pdf',
];

const MIME_EXTENSION_MAP: Record<string, string[]> = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/jpg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'application/pdf': ['.pdf'],
};

const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8MB
const SIGNING_SECRET = process.env.JWT_SECRET || 'zupit_secret_key_change_in_production_jamui_hub_2026';

/**
 * Generates a signed URL that expires in `expiresInSeconds` (default: 300 = 5 minutes).
 */
export function createSignedUrl(fileKey: string, expiresInSeconds: number = 300): string {
  const expires = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const signature = crypto
    .createHmac('sha256', SIGNING_SECRET)
    .update(`${fileKey}:${expires}`)
    .digest('hex');
  return `/api/v1/uploads/signed/${fileKey}?expires=${expires}&sig=${signature}`;
}

/**
 * Validates a signed URL's HMAC signature and expiration timestamp.
 */
export function verifySignedUrl(fileKey: string, expires: number, signature: string): boolean {
  if (Math.floor(Date.now() / 1000) > expires) {
    return false;
  }
  const expected = crypto
    .createHmac('sha256', SIGNING_SECRET)
    .update(`${fileKey}:${expires}`)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

const PresignSchema = z.object({
  fileName: z.string().min(1),
  mimeType: z.string().refine((val) => ALLOWED_MIME_TYPES.includes(val.toLowerCase()), {
    message: 'Allowed file formats are JPG, PNG, WEBP, or PDF.',
  }),
  fileSize: z.number().max(MAX_FILE_SIZE, 'File size must not exceed 8MB.'),
});

// Ensure upload directory exists
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

/**
 * POST /api/v1/uploads/presign
 * Guest allowed, rate limit: 10 per hour per IP
 * Validates mime, size, and extension; returns an upload URL, signed URL, and file_key
 */
router.post('/presign', async (req: Request, res: Response): Promise<void> => {
  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

  // Check if authenticated rider or admin (exempt from guest IP limit)
  const isRiderOrAdmin = Boolean(req.cookies?.rider_access_token || req.cookies?.admin_token || req.headers.authorization);

  if (!isRiderOrAdmin) {
    // Rate limit for guests: 10 per hour per IP (3600 seconds)
    const rl = await rateLimit(`upload_presign:${clientIp}`, 10, 3600);
    if (!rl.success) {
      res.status(429).json({
        success: false,
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Upload rate limit reached (10 per hour). Please try again later.',
        resetTime: rl.resetTime,
      });
      return;
    }
  }

  const parsed = PresignSchema.safeParse(req.body);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues[0]?.message || 'Invalid upload parameters.';
    res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: errorMsg,
      details: parsed.error.format(),
    });
    return;
  }

  const { fileName, mimeType } = parsed.data;

  // Extension validation & spoofing check
  const ext = path.extname(fileName).toLowerCase();
  const allowedExts = MIME_EXTENSION_MAP[mimeType.toLowerCase()] || [];

  if (ext && !allowedExts.includes(ext)) {
    res.status(400).json({
      success: false,
      error: 'INVALID_EXTENSION',
      message: `File extension '${ext}' does not match declared mime type '${mimeType}'.`,
    });
    return;
  }

  const finalExt = ext || allowedExts[0] || '.jpg';
  const safeBase = path.basename(fileName, ext).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
  const randomSuffix = crypto.randomBytes(8).toString('hex');
  const fileKey = `rx_${Date.now()}_${safeBase}_${randomSuffix}${finalExt}`;

  // Direct upload URL and 5-minute signed URL
  const uploadUrl = `/api/v1/uploads/file/${fileKey}`;
  const publicUrl = `/public/uploads/${fileKey}`;
  const signedUrl = createSignedUrl(fileKey, 300);

  res.status(200).json({
    success: true,
    file_key: fileKey,
    fileKey,
    uploadUrl,
    publicUrl,
    signedUrl,
    maxSizeBytes: MAX_FILE_SIZE,
    allowedMimeTypes: ALLOWED_MIME_TYPES,
  });
});

/**
 * GET /api/v1/uploads/signed/:fileKey
 * Serves files via time-limited HMAC-signed URLs (expires after 5 minutes).
 * Logs an audit_logs entry if viewed by an admin or for prescription files.
 */
router.get('/signed/:fileKey', async (req: Request, res: Response): Promise<void> => {
  const fileKeyParam = req.params.fileKey;
  const fileKey = (Array.isArray(fileKeyParam) ? fileKeyParam[0] : fileKeyParam) || '';
  const expires = parseInt(req.query.expires as string, 10);
  const sig = req.query.sig as string;

  if (!expires || !sig) {
    res.status(400).json({
      success: false,
      error: 'INVALID_REQUEST',
      message: 'Signed URL missing signature or expiration parameters.',
    });
    return;
  }

  if (Math.floor(Date.now() / 1000) > expires) {
    res.status(403).json({
      success: false,
      error: 'URL_EXPIRED',
      message: 'This signed URL has expired. Please request a new link.',
    });
    return;
  }

  if (!verifySignedUrl(fileKey, expires, sig)) {
    res.status(403).json({
      success: false,
      error: 'INVALID_SIGNATURE',
      message: 'Invalid signature for requested file.',
    });
    return;
  }

  const safeFileName = path.basename(fileKey);
  const targetPath = path.join(UPLOAD_DIR, safeFileName);

  if (!fs.existsSync(targetPath)) {
    res.status(404).json({
      success: false,
      error: 'FILE_NOT_FOUND',
      message: 'The requested file could not be found.',
    });
    return;
  }

  // Audit log prescription view if admin session present
  const adminCookie = req.cookies?.admin_token;
  if (adminCookie) {
    const admin = await verifyAdminToken(adminCookie);
    if (admin) {
      const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
      await auditService.log(
        { actorType: 'admin', actorId: admin.userId, ipAddress: clientIp },
        'prescription_viewed',
        { type: 'file', id: safeFileName },
        { fileKey: safeFileName, adminEmail: admin.email }
      );
    }
  }

  // Stream file
  res.sendFile(targetPath);
});

/**
 * PUT or POST /api/v1/uploads/file/:fileKey
 * Receives the raw binary stream data
 */
const handleFileUpload = (req: Request, res: Response): void => {
  const fileKeyParam = req.params.fileKey;
  const fileKey = (Array.isArray(fileKeyParam) ? fileKeyParam[0] : fileKeyParam) || '';
  const safeFileName = path.basename(fileKey);
  const targetPath = path.join(UPLOAD_DIR, safeFileName);

  const fileStream = fs.createWriteStream(targetPath);
  let totalBytes = 0;

  req.on('data', (chunk) => {
    totalBytes += chunk.length;
    if (totalBytes > MAX_FILE_SIZE) {
      fileStream.destroy();
      fs.unlink(targetPath, () => {});
      if (!res.headersSent) {
        res.status(413).json({
          success: false,
          error: 'FILE_TOO_LARGE',
          message: 'Uploaded file exceeds the 8MB limit.',
        });
      }
    }
  });

  req.pipe(fileStream);

  fileStream.on('finish', () => {
    if (!res.headersSent) {
      res.status(200).json({
        success: true,
        message: 'Prescription uploaded successfully.',
        fileKey: safeFileName,
        fileUrl: `/public/uploads/${safeFileName}`,
        signedUrl: createSignedUrl(safeFileName, 300),
      });
    }
  });

  fileStream.on('error', (err) => {
    console.error('File write error:', err);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'UPLOAD_FAILED',
        message: 'Could not write file to storage.',
      });
    }
  });
};

router.put('/file/:fileKey', handleFileUpload);
router.post('/file/:fileKey', handleFileUpload);

export default router;
