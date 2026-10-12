import { z } from 'zod';
import { db } from '../db/index.js';
import { settings } from '../db/schema.js';
import { eq, inArray } from 'drizzle-orm';
import { auditService, type AuditActor } from './auditService.js';

/**
 * Strongly typed Zod schema for platform settings
 */
export const SettingsSchema = z.object({
  delivery_fee: z.coerce.number().min(0).default(0),
  service_fee: z.coerce.number().min(0).default(0),
  cod_enabled: z.coerce.boolean().default(true),
  cod_limit: z.coerce.number().min(0).default(5000),
  bill_confirm_threshold: z.coerce.number().min(0).default(2000),
  accept_timeout_minutes: z.coerce.number().min(1).default(5),
  otp_max_attempts: z.coerce.number().min(1).default(5),
});

export type SettingsData = z.infer<typeof SettingsSchema>;
export type SettingKey = keyof SettingsData;

export class SettingsService {
  /**
   * Retrieves all typed settings from the database with Zod fallback defaults
   */
  async getAll(): Promise<SettingsData> {
    const rows = await db.select().from(settings);
    const rawMap: Record<string, unknown> = {};

    for (const r of rows) {
      if (r.key === 'cod_enabled') {
        rawMap[r.key] = r.value === 'true' || r.value === '1';
      } else if (
        ['delivery_fee', 'service_fee', 'cod_limit', 'bill_confirm_threshold', 'accept_timeout_minutes', 'otp_max_attempts'].includes(r.key)
      ) {
        rawMap[r.key] = Number(r.value);
      } else {
        rawMap[r.key] = r.value;
      }
    }

    return SettingsSchema.parse(rawMap);
  }

  /**
   * Returns public configuration: only cod_enabled and delivery_fee
   */
  async getPublicConfig(): Promise<{ cod_enabled: boolean; delivery_fee: number }> {
    const all = await this.getAll();
    return {
      cod_enabled: all.cod_enabled,
      delivery_fee: all.delivery_fee,
    };
  }

  /**
   * Updates partial or full settings, validated by Zod, and records an audit log
   */
  async update(
    partialSettings: Partial<SettingsData>,
    actor: AuditActor
  ): Promise<SettingsData> {
    const current = await this.getAll();
    const merged = { ...current, ...partialSettings };
    const validated = SettingsSchema.parse(merged);

    // Save modified keys
    const modifiedKeys: string[] = [];
    for (const [k, v] of Object.entries(partialSettings)) {
      if (v !== undefined) {
        const strVal = String(v);
        await db
          .insert(settings)
          .values({
            key: k,
            value: strVal,
          })
          .onConflictDoUpdate({
            target: settings.key,
            set: {
              value: strVal,
              updatedAt: new Date(),
            },
          });
        modifiedKeys.push(k);
      }
    }

    // Write audit log for the settings change
    await auditService.log(
      actor,
      'settings_updated',
      { type: 'settings', id: 'global' },
      {
        modifiedKeys,
        changes: partialSettings,
        newValues: validated,
      }
    );

    return validated;
  }
}

export const settingsService = new SettingsService();
