import { Router, type Request, type Response } from 'express';
import { settingsService, SettingsSchema } from '../services/settingsService.js';
import { requireAdminApi, requireRole } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { auditLogs } from '../db/schema.js';
import { desc } from 'drizzle-orm';

const router = Router();

/**
 * GET /api/v1/public/config
 * Returns only cod_enabled and delivery_fee (publicly accessible)
 */
router.get('/public/config', async (_req: Request, res: Response): Promise<void> => {
  try {
    const config = await settingsService.getPublicConfig();
    res.status(200).json({
      success: true,
      config,
    });
  } catch (err) {
    console.error('Error fetching public config:', err);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'Failed to retrieve configuration.',
    });
  }
});

/**
 * GET /api/v1/admin/settings
 * Returns all settings (protected by admin auth)
 */
router.get('/admin/settings', requireAdminApi, async (_req: Request, res: Response): Promise<void> => {
  try {
    const all = await settingsService.getAll();
    res.status(200).json({
      success: true,
      settings: all,
    });
  } catch (err) {
    console.error('Error fetching admin settings:', err);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'Failed to retrieve admin settings.',
    });
  }
});

/**
 * PUT /api/v1/admin/settings
 * Updates settings with Zod validation and records an audit log
 */
router.put(
  '/admin/settings',
  requireAdminApi,
  requireRole(['owner']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

      // Validate input partially
      const partialSchema = SettingsSchema.partial();
      const parsed = partialSchema.safeParse(req.body);

      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'Invalid settings payload format.',
          details: parsed.error.format(),
        });
        return;
      }

      const updated = await settingsService.update(parsed.data, {
        actorType: 'admin',
        actorId: req.admin?.userId,
        ipAddress: clientIp,
      });

      res.status(200).json({
        success: true,
        message: 'Settings updated successfully.',
        settings: updated,
      });
    } catch (err) {
      console.error('Error updating admin settings:', err);
      res.status(500).json({
        success: false,
        error: 'SERVER_ERROR',
        message: 'Failed to update settings.',
      });
    }
  }
);

/**
 * GET /api/v1/admin/audit-logs
 * Retrieves latest 50 audit log events for ops transparency
 */
router.get(
  '/admin/audit-logs',
  requireAdminApi,
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const logs = await db
        .select()
        .from(auditLogs)
        .orderBy(desc(auditLogs.createdAt))
        .limit(50);

      res.status(200).json({
        success: true,
        logs,
      });
    } catch (err) {
      console.error('Error fetching audit logs:', err);
      res.status(500).json({
        success: false,
        error: 'SERVER_ERROR',
        message: 'Failed to retrieve audit logs.',
      });
    }
  }
);

export default router;
