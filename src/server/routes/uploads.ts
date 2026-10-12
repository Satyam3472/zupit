import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { rateLimit } from '../utils/rateLimit.js';

const router = Router();

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/jpg',
  'application/pdf',
];

const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8MB

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
 * Validates mime and size, returns an upload URL and a file_key
 */
router.post('/presign', async (req: Request, res: Response): Promise<void> => {
  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
  
  // Rate limit: 10 per hour per IP (3600 seconds)
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

  const { fileName, mimeType, fileSize } = parsed.data;

  // Derive file extension
  const ext = path.extname(fileName) || (mimeType === 'application/pdf' ? '.pdf' : '.jpg');
  const safeBase = path.basename(fileName, ext).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
  const randomSuffix = crypto.randomBytes(8).toString('hex');
  const fileKey = `rx_${Date.now()}_${safeBase}_${randomSuffix}${ext}`;

  // Direct upload URL handled by Express
  const uploadUrl = `/api/v1/uploads/file/${fileKey}`;
  const publicUrl = `/public/uploads/${fileKey}`;

  res.status(200).json({
    success: true,
    file_key: fileKey,
    fileKey,
    uploadUrl,
    publicUrl,
    maxSizeBytes: MAX_FILE_SIZE,
    allowedMimeTypes: ALLOWED_MIME_TYPES,
  });
});

/**
 * PUT or POST /api/v1/uploads/file/:fileKey
 * Receives the raw or multi-part binary file data
 */
router.put('/file/:fileKey', (req: Request, res: Response): void => {
  const fileKeyParam = req.params.fileKey;
  const fileKey = (Array.isArray(fileKeyParam) ? fileKeyParam[0] : fileKeyParam) || '';
  // Sanitize fileKey to prevent directory traversal
  const safeFileName = path.basename(fileKey);
  const targetPath = path.join(UPLOAD_DIR, safeFileName);

  const fileStream = fs.createWriteStream(targetPath);
  let totalBytes = 0;

  req.on('data', (chunk) => {
    totalBytes += chunk.length;
    if (totalBytes > MAX_FILE_SIZE) {
      fileStream.destroy();
      fs.unlink(targetPath, () => {});
      res.status(413).json({
        success: false,
        error: 'FILE_TOO_LARGE',
        message: 'Uploaded file exceeds the 8MB limit.',
      });
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
});

export default router;
