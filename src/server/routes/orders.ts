import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { eq, and, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  orders,
  orderItems,
  prescriptions,
  orderStatusEvents,
  customers,
  addresses,
  serviceableAreas,
} from '../db/schema.js';
import { settingsService } from '../services/settingsService.js';
import { rateLimit } from '../utils/rateLimit.js';

const router = Router();

const MedicineItemSchema = z.object({
  name: z.string().trim().min(1, 'Medicine name is required'),
  strength: z.string().trim().optional(),
  quantity: z.number().int().min(1, 'Quantity must be at least 1').default(1),
  notes: z.string().trim().optional(),
});

const PrescriptionItemSchema = z.object({
  fileUrl: z.string().min(1, 'File URL is required'),
  fileType: z.string().optional(),
  fileSize: z.number().optional(),
  notes: z.string().optional(),
});

const CreateOrderSchema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters'),
    mobile: z
      .string()
      .trim()
      .transform((v) => v.replace(/\D/g, '').slice(-10))
      .refine((v) => /^[6-9]\d{9}$/.test(v), {
        message: 'Enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9',
      }),
    houseArea: z.string().trim().min(3, 'House or area details are required'),
    landmark: z.string().trim().optional(),
    pincode: z
      .string()
      .trim()
      .transform((v) => v.replace(/\D/g, ''))
      .refine((v) => /^\d{6}$/.test(v), {
        message: 'Pincode must be exactly 6 digits',
      }),
    paymentMethod: z.enum(['cod', 'online']).default('cod'),
    notes: z.string().trim().optional(),
    medicines: z.array(MedicineItemSchema).optional().default([]),
    prescriptions: z.array(PrescriptionItemSchema).optional().default([]),
  })
  .refine(
    (data) => (data.medicines && data.medicines.length > 0) || (data.prescriptions && data.prescriptions.length > 0),
    {
      message: 'Please add at least one medicine or upload a prescription to place an order.',
      path: ['medicines'],
    }
  );

/**
 * POST /api/v1/orders
 * Creates a new order in a single atomic transaction.
 * Rate limited to 5 per hour per phone and 10 per hour per IP.
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

  // 1. IP Rate Limiting (10 orders per hour per IP)
  const ipLimit = await rateLimit(`order_ip:${clientIp}`, 10, 3600);
  if (!ipLimit.success) {
    res.status(429).json({
      success: false,
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many orders placed from this network. Please wait an hour or call us.',
      resetTime: ipLimit.resetTime,
    });
    return;
  }

  // 2. Schema Validation
  const parsed = CreateOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: firstIssue?.message || 'Invalid order parameters.',
      details: parsed.error.format(),
    });
    return;
  }

  const {
    name,
    mobile: phone,
    houseArea,
    landmark,
    pincode,
    paymentMethod,
    notes,
    medicines,
    prescriptions: rxList,
  } = parsed.data;

  // 3. Phone Rate Limiting (5 orders per hour per phone)
  const phoneLimit = await rateLimit(`order_phone:${phone}`, 5, 3600);
  if (!phoneLimit.success) {
    res.status(429).json({
      success: false,
      error: 'PHONE_RATE_LIMIT_EXCEEDED',
      message: 'Maximum order limit reached for this mobile number (5 per hour). Call us for urgent needs.',
      resetTime: phoneLimit.resetTime,
    });
    return;
  }

  try {
    // 4. Atomic Transaction Execution
    const result = await db.transaction(async (tx) => {
      // 4a. Check Customer Blocklist
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

      // 4b. Check Serviceable Area
      const [area] = await tx
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

      // 4c. Check Payment Method Settings
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

      // 4d. Upsert Customer Record
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

      // 4e. Create Address and Snapshot
      const addressSnapshot = {
        recipientName: name,
        recipientPhone: phone,
        houseArea,
        landmark: landmark || '',
        pincode,
        city: 'Jamui',
        state: 'Bihar',
      };

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

      // 4f. Generate 32-character tracking token & 4-digit verification code
      const trackingToken = crypto.randomBytes(16).toString('hex'); // 32 hex chars
      const deliveryCode = Math.floor(1000 + Math.random() * 9000).toString();

      // 4g. Create Order Record
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
          source: 'web',
          paymentMethod: paymentMethod === 'online' ? 'online' : 'cod',
          paymentStatus: 'pending',
          notes: notes || null,
          trackingToken,
        })
        .returning({
          id: orders.id,
          orderNumber: orders.orderNumber,
          trackingToken: orders.trackingToken,
        });

      // 4h. Insert Medicine Items
      if (medicines && medicines.length > 0) {
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
      }

      // 4i. Insert Prescriptions
      if (rxList && rxList.length > 0) {
        for (const rx of rxList) {
          await tx.insert(prescriptions).values({
            orderId: newOrder.id,
            fileUrl: rx.fileUrl,
            fileType: rx.fileType || null,
            fileSize: rx.fileSize || null,
            notes: rx.notes || null,
          });
        }
      }

      // 4j. Create First order_status_events Row
      await tx.insert(orderStatusEvents).values({
        orderId: newOrder.id,
        status: 'placed',
        actorType: 'customer',
        actorId: customerId,
        notes: 'Order placed via Zupit web app',
        metadata: {
          ip: clientIp,
          itemCount: medicines.length,
          prescriptionCount: rxList.length,
          paymentMethod,
          addressSnapshot,
        },
      });

      return {
        orderNumber: newOrder.orderNumber,
        trackingToken: newOrder.trackingToken,
      };
    });

    res.status(201).json({
      success: true,
      orderNumber: result.orderNumber,
      trackingToken: result.trackingToken,
      message: 'Order placed successfully. A Zupit rider will call you shortly to confirm.',
    });
  } catch (err: any) {
    if (err && err.status) {
      res.status(err.status).json({
        success: false,
        error: err.code || 'ORDER_CREATION_FAILED',
        message: err.message,
      });
      return;
    }
    console.error('Error in order creation transaction:', err);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'Could not place your order. Please try again or call Jamui support.',
    });
  }
});

/**
 * GET /api/v1/orders/track/:trackingToken
 * Retrieves public tracking details for the placed order
 */
router.get('/track/:trackingToken', async (req: Request, res: Response): Promise<void> => {
  const tokenParam = req.params.trackingToken;
  const trackingToken = (Array.isArray(tokenParam) ? tokenParam[0] : tokenParam) || '';

  try {
    const [order] = await db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        status: orders.status,
        paymentMethod: orders.paymentMethod,
        paymentStatus: orders.paymentStatus,
        deliveryName: orders.deliveryName,
        deliveryPhone: orders.deliveryPhone,
        deliveryAddress: orders.deliveryAddress,
        deliveryLandmark: orders.deliveryLandmark,
        deliveryPincode: orders.deliveryPincode,
        deliveryCode: orders.deliveryCode,
        totalAmount: orders.totalAmount,
        deliveryFee: orders.deliveryFee,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .where(eq(orders.trackingToken, trackingToken))
      .limit(1);

    if (!order) {
      res.status(404).json({
        success: false,
        error: 'ORDER_NOT_FOUND',
        message: 'Order not found for this tracking link.',
      });
      return;
    }

    const items = await db
      .select({
        id: orderItems.id,
        name: orderItems.name,
        strength: orderItems.strength,
        quantity: orderItems.quantity,
        status: orderItems.status,
      })
      .from(orderItems)
      .where(eq(orderItems.orderId, order.id));

    const rx = await db
      .select({
        id: prescriptions.id,
        fileUrl: prescriptions.fileUrl,
        fileType: prescriptions.fileType,
      })
      .from(prescriptions)
      .where(eq(prescriptions.orderId, order.id));

    res.status(200).json({
      success: true,
      order: {
        ...order,
        items,
        prescriptions: rx,
      },
    });
  } catch (err) {
    console.error('Error tracking order:', err);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'Failed to retrieve order tracking information.',
    });
  }
});

export default router;
