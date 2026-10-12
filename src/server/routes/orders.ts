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
import { orderService } from '../services/orderService.js';
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
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100, 'Name must not exceed 100 characters'),
    mobile: z
      .string()
      .trim()
      .transform((v) => v.replace(/\D/g, '').slice(-10))
      .refine((v) => /^[6-9]\d{9}$/.test(v), {
        message: 'Enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9',
      }),
    houseArea: z.string().trim().min(3, 'House or area details are required').max(200, 'House or area details must not exceed 200 characters'),
    landmark: z.string().trim().max(100, 'Landmark must not exceed 100 characters').optional(),
    pincode: z
      .string()
      .trim()
      .transform((v) => v.replace(/\D/g, ''))
      .refine((v) => /^\d{6}$/.test(v), {
        message: 'Pincode must be exactly 6 digits',
      }),
    paymentMethod: z.enum(['cod', 'online']).default('cod'),
    notes: z.string().trim().max(500, 'Notes must not exceed 500 characters').optional(),
    medicines: z.array(MedicineItemSchema).optional().default([]),
    prescriptions: z.array(PrescriptionItemSchema).max(5, 'Maximum 5 prescription files allowed.').optional().default([]),
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
    const idempotencyKey = (req.headers['x-idempotency-key'] as string) || (req.body?.idempotencyKey as string) || undefined;

    const result = await orderService.createOrder({
      name,
      phone,
      houseArea,
      landmark,
      pincode,
      paymentMethod,
      source: 'web',
      notes,
      medicines,
      prescriptions: rxList,
      clientIp,
      idempotencyKey,
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
        code: err.code || 'ORDER_CREATION_FAILED',
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
