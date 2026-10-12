import crypto from 'crypto';
import { eq, and, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  orders,
  orderItems,
  orderStatusEvents,
  customers,
  addresses,
  prescriptions,
  serviceableAreas,
} from '../db/schema.js';
import { settingsService } from './settingsService.js';

export type OrderStatus =
  | 'placed'
  | 'rider_assigned'
  | 'buying'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'
  | 'delivery_failed';

export const VALID_ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  placed: ['rider_assigned', 'cancelled'],
  rider_assigned: ['buying', 'placed', 'cancelled'],
  buying: ['out_for_delivery', 'delivery_failed', 'cancelled'],
  out_for_delivery: ['delivered', 'delivery_failed'],
  delivered: [],
  cancelled: [],
  delivery_failed: ['placed', 'rider_assigned'], // Admin re-dispatch
};

export interface TransitionActor {
  actorType: 'customer' | 'rider' | 'admin' | 'system';
  actorId?: string;
  ipAddress?: string;
}

export interface CreateOrderParams {
  name: string;
  phone: string;
  houseArea: string;
  landmark?: string | null;
  pincode: string;
  paymentMethod: 'cod' | 'online';
  source?: 'web' | 'phone' | 'whatsapp';
  notes?: string | null;
  medicines?: Array<{
    name: string;
    strength?: string | null;
    quantity: number;
    notes?: string | null;
  }>;
  prescriptions?: Array<{
    fileUrl: string;
    fileType?: string | null;
    fileSize?: number | null;
    notes?: string | null;
  }>;
  createdByAdminId?: string;
  clientIp?: string;
  idempotencyKey?: string;
}

export interface CreateOrderResult {
  orderId: string;
  orderNumber: string;
  trackingToken: string;
  deliveryCode: string;
}

// In-memory idempotency cache (TTL: 10 minutes)
interface CachedIdempotency {
  result: CreateOrderResult;
  timestamp: number;
}
const idempotencyStore = new Map<string, CachedIdempotency>();

export class OrderService {
  /**
   * Enforces legal order state transitions and records timeline event atomically.
   */
  async transition(
    orderId: string,
    newStatus: OrderStatus,
    actor: TransitionActor,
    notes?: string,
    metadata?: Record<string, unknown>
  ): Promise<{ success: boolean; previousStatus: OrderStatus; status: OrderStatus }> {
    return await db.transaction(async (tx) => {
      const [order] = await tx
        .select({ id: orders.id, status: orders.status })
        .from(orders)
        .where(eq(orders.id, orderId))
        .limit(1);

      if (!order) {
        throw new Error(`ORDER_NOT_FOUND: Order with ID '${orderId}' not found.`);
      }

      const currentStatus = order.status as OrderStatus;
      const allowed = VALID_ORDER_TRANSITIONS[currentStatus] || [];

      if (!allowed.includes(newStatus)) {
        throw new Error(
          `ILLEGAL_TRANSITION: Cannot transition order from '${currentStatus}' to '${newStatus}'. Allowed: [${allowed.join(', ')}]`
        );
      }

      // Update status
      await tx
        .update(orders)
        .set({
          status: newStatus,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, orderId));

      // Insert timeline event
      await tx.insert(orderStatusEvents).values({
        orderId,
        status: newStatus,
        actorType: actor.actorType,
        actorId: actor.actorId || null,
        notes: notes || `Status changed from ${currentStatus} to ${newStatus}`,
        metadata: metadata || null,
      });

      return {
        success: true,
        previousStatus: currentStatus,
        status: newStatus,
      };
    });
  }

  /**
   * Single reusable order creation service with idempotency and atomic writes
   */
  async createOrder(params: CreateOrderParams): Promise<CreateOrderResult> {
    const {
      name,
      phone: rawPhone,
      houseArea,
      landmark,
      pincode,
      paymentMethod,
      source = 'web',
      notes,
      medicines = [],
      prescriptions: rxList = [],
      createdByAdminId,
      clientIp = '127.0.0.1',
      idempotencyKey,
    } = params;

    const phone = rawPhone.replace(/\D/g, '').slice(-10);

    // 1. Idempotency Check
    if (idempotencyKey) {
      const cached = idempotencyStore.get(idempotencyKey);
      if (cached && Date.now() - cached.timestamp < 10 * 60 * 1000) {
        return cached.result;
      }
    }

    // 2. Validate Serviceable Area
    const [area] = await db
      .select()
      .from(serviceableAreas)
      .where(and(eq(serviceableAreas.pincode, pincode), eq(serviceableAreas.isActive, true)))
      .limit(1);

    if (!area) {
      throw {
        status: 400,
        code: 'UNSERVICEABLE_PINCODE',
        message: 'We do not deliver to this area yet.',
      };
    }

    // 3. Validate Payment Method
    const platformSettings = await settingsService.getAll();
    if (paymentMethod === 'cod') {
      if (!platformSettings.cod_enabled) {
        throw {
          status: 400,
          code: 'COD_DISABLED',
          message: 'Cash on Delivery is currently disabled. Please select online payment.',
        };
      }
    } else if (paymentMethod === 'online') {
      if (!platformSettings.payments_enabled) {
        throw {
          status: 400,
          code: 'ONLINE_PAYMENTS_DISABLED',
          message: 'Online payments are currently disabled. Please select Cash on Delivery.',
        };
      }
    }

    // 4. Validate non-empty order
    if (medicines.length === 0 && rxList.length === 0) {
      throw {
        status: 400,
        code: 'EMPTY_ORDER',
        message: 'Please add at least one medicine or upload a prescription to place an order.',
      };
    }

    // 5. Execute Atomic Transaction
    const result = await db.transaction(async (tx) => {
      // 5a. Check Customer Blocklist
      const [existingCustomer] = await tx
        .select()
        .from(customers)
        .where(eq(customers.phone, phone))
        .limit(1);

      if (existingCustomer && !existingCustomer.isActive) {
        throw {
          status: 403,
          code: 'CUSTOMER_BLOCKED',
          message: 'Please call our support team at +91 62078 56200 to place your order.',
        };
      }

      let customerId: string;
      if (existingCustomer) {
        customerId = existingCustomer.id;
        await tx
          .update(customers)
          .set({ name, updatedAt: new Date() })
          .where(eq(customers.id, customerId));
      } else {
        const [newCustomer] = await tx
          .insert(customers)
          .values({
            name,
            phone,
            isActive: true,
          })
          .returning({ id: customers.id });
        customerId = newCustomer.id;
      }

      // 5b. Create Address
      const [newAddress] = await tx
        .insert(addresses)
        .values({
          customerId,
          recipientName: name,
          recipientPhone: phone,
          houseFlat: houseArea,
          streetArea: houseArea,
          landmark: landmark || null,
          pincode,
          city: 'Jamui',
          state: 'Bihar',
        })
        .returning({ id: addresses.id });

      const trackingToken = crypto.randomBytes(16).toString('hex');
      const deliveryCode = Math.floor(1000 + Math.random() * 9000).toString();

      // 5c. Create Order
      const [newOrder] = await tx
        .insert(orders)
        .values({
          customerId,
          addressId: newAddress.id,
          deliveryName: name,
          deliveryPhone: phone,
          deliveryAddress: houseArea,
          deliveryLandmark: landmark || null,
          deliveryPincode: pincode,
          deliveryCode,
          status: 'placed',
          source,
          paymentMethod: paymentMethod === 'online' ? 'online' : 'cod',
          paymentStatus: 'pending',
          notes: notes || null,
          trackingToken,
          createdByAdminId: createdByAdminId || null,
        })
        .returning({
          id: orders.id,
          orderNumber: orders.orderNumber,
          trackingToken: orders.trackingToken,
        });

      // 5d. Insert Medicine Items
      for (const item of medicines) {
        await tx.insert(orderItems).values({
          orderId: newOrder.id,
          name: item.name,
          strength: item.strength || null,
          quantity: item.quantity,
          notes: item.notes || null,
          status: 'pending',
        });
      }

      // 5e. Insert Prescriptions
      for (const rx of rxList) {
        await tx.insert(prescriptions).values({
          orderId: newOrder.id,
          fileUrl: rx.fileUrl,
          fileType: rx.fileType || null,
          fileSize: rx.fileSize || null,
          notes: rx.notes || null,
        });
      }

      // 5f. Timeline Event
      await tx.insert(orderStatusEvents).values({
        orderId: newOrder.id,
        status: 'placed',
        actorType: createdByAdminId ? 'admin' : 'customer',
        actorId: createdByAdminId || customerId,
        notes: createdByAdminId
          ? `Order created by admin via ${source}`
          : 'Order placed via Zupit web app',
        metadata: {
          ip: clientIp,
          itemCount: medicines.length,
          prescriptionCount: rxList.length,
          paymentMethod,
          source,
          createdByAdminId: createdByAdminId || null,
        },
      });

      return {
        orderId: newOrder.id,
        orderNumber: newOrder.orderNumber,
        trackingToken: newOrder.trackingToken,
        deliveryCode,
      };
    });

    // Cache idempotency result
    if (idempotencyKey) {
      idempotencyStore.set(idempotencyKey, {
        result,
        timestamp: Date.now(),
      });
    }

    return result;
  }
}

export const orderService = new OrderService();
