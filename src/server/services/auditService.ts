import { db } from '../db/index.js';
import { auditLogs, type actorTypeEnum } from '../db/schema.js';

export interface AuditActor {
  actorType: (typeof actorTypeEnum.enumValues)[number]; // 'customer' | 'rider' | 'admin' | 'system'
  actorId?: string;
  ipAddress?: string;
}

export interface AuditEntity {
  type: string; // e.g. 'settings', 'admin', 'rider', 'order'
  id?: string;
}

export class AuditService {
  /**
   * Records an audit log entry
   */
  async log(
    actor: AuditActor,
    action: string,
    entity: AuditEntity,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    try {
      const isValidUuid = (val?: string): boolean =>
        Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));

      const safeActorId = isValidUuid(actor.actorId) ? actor.actorId : null;
      const safeEntityId = isValidUuid(entity.id) ? entity.id : null;

      await db.insert(auditLogs).values({
        actorType: actor.actorType,
        actorId: safeActorId,
        action,
        entityType: entity.type,
        entityId: safeEntityId,
        details: metadata || null,
        ipAddress: actor.ipAddress || null,
      });
      console.log(`📝 [AUDIT] [${actor.actorType}:${safeActorId || 'anon'}] ${action} on ${entity.type}:${safeEntityId || entity.id || 'all'}`);
    } catch (err) {
      console.error('❌ [AUDIT] Failed to write audit log:', err);
    }
  }
}

export const auditService = new AuditService();
