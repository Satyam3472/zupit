import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { eq, and, sql, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  orders,
  orderItems,
  orderStatusEvents,
  riders,
  bills,
  orderRatings,
  prescriptions,
} from '../db/schema.js';
import { rateLimit } from '../utils/rateLimit.js';

const router = Router();

const LookupSchema = z.object({
  phone: z
    .string()
    .trim()
    .min(10, 'Mobile number must be at least 10 digits')
    .transform((val) => val.replace(/\D/g, '').slice(-10)),
  orderNumber: z.string().trim().min(3, 'Order ID is required'),
});

const ItemDecisionSchema = z.object({
  itemId: z.string().uuid('Invalid item ID'),
  decision: z.enum(['skip', 'call_me', 'cancel'], {
    message: "Decision must be one of 'skip', 'call_me', or 'cancel'",
  }),
});

const RatingSchema = z.object({
  stars: z.number().int().min(1).max(5, 'Rating must be between 1 and 5 stars'),
  comment: z.string().trim().max(300, 'Comment must not exceed 300 characters').optional(),
});

/**
 * POST /api/v1/track/lookup
 * Looks up an order by phone number and order ID.
 * Rate limited to 10 lookups per hour per IP and per phone.
 * Returns the exact same error if the order does not exist or the phone doesn't match.
 */
router.post('/lookup', async (req: Request, res: Response): Promise<void> => {
  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

  // 1. IP Rate Limiting (10 per hour per IP)
  const ipLimit = await rateLimit(`track_lookup_ip:${clientIp}`, 10, 3600);
  if (!ipLimit.success) {
    res.status(429).json({
      success: false,
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many lookup attempts from this network. Please try again later.',
      resetTime: ipLimit.resetTime,
    });
    return;
  }

  // 2. Validate input format
  const parsed = LookupSchema.safeParse(req.body);
  if (!parsed.success) {
    // Return standard friendly not-found message to prevent enumeration
    res.status(404).json({
      success: false,
      error: 'NOT_FOUND',
      message: 'We could not find this order. Check the number and try again.',
    });
    return;
  }

  const { phone, orderNumber } = parsed.data;

  // 3. Phone Rate Limiting (10 per hour per phone)
  const phoneLimit = await rateLimit(`track_lookup_phone:${phone}`, 10, 3600);
  if (!phoneLimit.success) {
    res.status(429).json({
      success: false,
      error: 'PHONE_RATE_LIMIT_EXCEEDED',
      message: 'Too many lookup attempts for this mobile number. Please try again later.',
      resetTime: phoneLimit.resetTime,
    });
    return;
  }

  try {
    // Format input orderNumber: accept 'ZP-10001' or '10001'
    const cleanOrderNumber = orderNumber.toUpperCase().trim();
    const formattedOrderNumber = cleanOrderNumber.startsWith('ZP-')
      ? cleanOrderNumber
      : `ZP-${cleanOrderNumber}`;

    // Query order by orderNumber
    const [order] = await db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        deliveryPhone: orders.deliveryPhone,
        trackingToken: orders.trackingToken,
      })
      .from(orders)
      .where(sql`UPPER(${orders.orderNumber}) = ${cleanOrderNumber} OR UPPER(${orders.orderNumber}) = ${formattedOrderNumber}`)
      .limit(1);

    // Uniform error whether order does not exist OR phone does not match
    const orderPhoneClean = order ? order.deliveryPhone.replace(/\D/g, '').slice(-10) : '';
    if (!order || orderPhoneClean !== phone) {
      res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'We could not find this order. Check the number and try again.',
      });
      return;
    }

    res.status(200).json({
      success: true,
      token: order.trackingToken,
      orderNumber: order.orderNumber,
    });
  } catch (err) {
    console.error('Error looking up order:', err);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'Failed to look up order. Please try again.',
    });
  }
});

/**
 * GET /api/v1/track/:token
 * Retrieves complete guest tracking information:
 * - status
 * - timeline (from order_status_events ordered by created_at asc)
 * - items
 * - rider (name, vehicle, phone) once assigned
 * - bills (signed/public URL + amount) once uploaded
 * - final_amount
 * - payment status
 * - delivery code ONLY while status is out_for_delivery
 * - any item marked unavailable that has no customer decision yet
 */
router.get('/:token', async (req: Request, res: Response): Promise<void> => {
  const tokenParam = req.params.token;
  const token = (Array.isArray(tokenParam) ? tokenParam[0] : tokenParam) || '';

  if (!token || token.trim() === '' || token === 'lookup') {
    res.status(404).json({
      success: false,
      error: 'NOT_FOUND',
      message: 'We could not find this order. Check the number and try again.',
    });
    return;
  }

  try {
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.trackingToken, token))
      .limit(1);

    if (!order) {
      res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'We could not find this order. Check the number and try again.',
      });
      return;
    }

    // 1. Fetch Timeline Events
    const timeline = await db
      .select({
        id: orderStatusEvents.id,
        status: orderStatusEvents.status,
        actorType: orderStatusEvents.actorType,
        notes: orderStatusEvents.notes,
        createdAt: orderStatusEvents.createdAt,
      })
      .from(orderStatusEvents)
      .where(eq(orderStatusEvents.orderId, order.id))
      .orderBy(orderStatusEvents.createdAt);

    // 2. Fetch Order Items
    const items = await db
      .select({
        id: orderItems.id,
        name: orderItems.name,
        strength: orderItems.strength,
        quantity: orderItems.quantity,
        unitPrice: orderItems.unitPrice,
        totalPrice: orderItems.totalPrice,
        status: orderItems.status,
        notes: orderItems.notes,
      })
      .from(orderItems)
      .where(eq(orderItems.orderId, order.id));

    // 3. Fetch Assigned Rider Details (if any)
    let rider = null;
    if (order.riderId) {
      const [riderRecord] = await db
        .select({
          name: riders.name,
          phone: riders.phone,
          vehicleType: riders.vehicleType,
          vehicleNumber: riders.vehicleNumber,
        })
        .from(riders)
        .where(eq(riders.id, order.riderId))
        .limit(1);

      if (riderRecord) {
        const vehicleDisplay = riderRecord.vehicleNumber
          ? `${riderRecord.vehicleNumber}${riderRecord.vehicleType ? ` (${riderRecord.vehicleType})` : ''}`
          : (riderRecord.vehicleType || 'Two-wheeler');

        rider = {
          name: riderRecord.name,
          phone: riderRecord.phone,
          vehicle: vehicleDisplay,
          vehicleNumber: riderRecord.vehicleNumber || '',
          vehicleType: riderRecord.vehicleType || '',
        };
      }
    }

    // 4. Fetch Uploaded Bills
    const billsList = await db
      .select({
        id: bills.id,
        billImageUrl: bills.billImageUrl,
        amount: bills.amount,
        pharmacyName: bills.pharmacyName,
        billNumber: bills.billNumber,
        createdAt: bills.createdAt,
      })
      .from(bills)
      .where(eq(bills.orderId, order.id))
      .orderBy(bills.createdAt);

    // 5. Prescriptions (if any)
    const rxList = await db
      .select({
        id: prescriptions.id,
        fileUrl: prescriptions.fileUrl,
        fileType: prescriptions.fileType,
      })
      .from(prescriptions)
      .where(eq(prescriptions.orderId, order.id));

    // 6. Rating (if submitted)
    let rating = null;
    const [existingRating] = await db
      .select({
        rating: orderRatings.rating,
        comment: orderRatings.comment,
        createdAt: orderRatings.createdAt,
      })
      .from(orderRatings)
      .where(eq(orderRatings.orderId, order.id))
      .limit(1);

    if (existingRating) {
      rating = existingRating;
    }

    // 7. Calculate Final Amount
    let finalAmount = order.totalAmount;
    if (billsList.length > 0) {
      const latestBill = billsList[billsList.length - 1];
      if (latestBill && latestBill.amount) {
        finalAmount = latestBill.amount;
      }
    }

    // 8. Delivery Code: ONLY returned while status is 'out_for_delivery'
    const deliveryCode = order.status === 'out_for_delivery' ? order.deliveryCode : null;

    // 9. Unavailable item with NO customer decision yet
    const pendingUnavailable = items.find(
      (it) => it.status === 'unavailable' && !(it.notes && it.notes.includes('[Customer decision:'))
    );
    const unavailableItem = pendingUnavailable
      ? {
          id: pendingUnavailable.id,
          name: pendingUnavailable.name,
          strength: pendingUnavailable.strength,
          quantity: pendingUnavailable.quantity,
          notes: pendingUnavailable.notes,
        }
      : null;

    res.status(200).json({
      success: true,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        timeline,
        items,
        prescriptions: rxList,
        rider,
        bills: billsList,
        final_amount: finalAmount,
        totalAmount: finalAmount,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        payment: {
          status: order.paymentStatus,
          method: order.paymentMethod,
        },
        deliveryCode,
        unavailableItem,
        deliveryAddress: order.deliveryAddress,
        deliveryLandmark: order.deliveryLandmark,
        deliveryPincode: order.deliveryPincode,
        deliveryPhone: order.deliveryPhone,
        deliveryName: order.deliveryName,
        cancelReason: order.cancelReason,
        rating,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      },
    });
  } catch (err) {
    console.error('Error fetching order tracking info:', err);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'Failed to retrieve tracking info.',
    });
  }
});

/**
 * POST /api/v1/track/:token/cancel
 * Allows cancelling an order ONLY while status is 'placed' or 'rider_assigned'.
 * Once buying begins (or later), cancellation is rejected.
 */
router.post('/:token/cancel', async (req: Request, res: Response): Promise<void> => {
  const tokenParam = req.params.token;
  const token = (Array.isArray(tokenParam) ? tokenParam[0] : tokenParam) || '';

  try {
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.trackingToken, token))
      .limit(1);

    if (!order) {
      res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'We could not find this order. Check the number and try again.',
      });
      return;
    }

    // Only allow in 'placed' or 'rider_assigned'
    if (order.status !== 'placed' && order.status !== 'rider_assigned') {
      res.status(400).json({
        success: false,
        error: 'CANNOT_CANCEL',
        message: 'Orders can only be cancelled before medicine purchase begins.',
      });
      return;
    }

    const reason = (req.body?.reason as string)?.trim() || 'Cancelled by customer via tracking page';

    await db.transaction(async (tx) => {
      await tx
        .update(orders)
        .set({
          status: 'cancelled',
          cancelReason: reason,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, order.id));

      await tx.insert(orderStatusEvents).values({
        orderId: order.id,
        status: 'cancelled',
        actorType: 'customer',
        actorId: order.customerId,
        notes: reason,
      });
    });

    res.status(200).json({
      success: true,
      message: 'Order cancelled successfully.',
    });
  } catch (err) {
    console.error('Error cancelling order:', err);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'Failed to cancel order. Please contact Jamui support.',
    });
  }
});

/**
 * POST /api/v1/track/:token/item-decision
 * Records customer's choice when an item is unavailable:
 * - 'skip': Skip item and proceed with remaining medicines
 * - 'call_me': Customer requests rider/pharmacist to call regarding alternatives
 * - 'cancel': Cancel the order entirely
 */
router.post('/:token/item-decision', async (req: Request, res: Response): Promise<void> => {
  const tokenParam = req.params.token;
  const token = (Array.isArray(tokenParam) ? tokenParam[0] : tokenParam) || '';

  const parsed = ItemDecisionSchema.safeParse(req.body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: firstIssue?.message || 'Invalid item decision parameters.',
    });
    return;
  }

  const { itemId, decision } = parsed.data;

  try {
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.trackingToken, token))
      .limit(1);

    if (!order) {
      res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'We could not find this order. Check the number and try again.',
      });
      return;
    }

    // Verify item belongs to this order
    const [item] = await db
      .select()
      .from(orderItems)
      .where(and(eq(orderItems.id, itemId), eq(orderItems.orderId, order.id)))
      .limit(1);

    if (!item) {
      res.status(404).json({
        success: false,
        error: 'ITEM_NOT_FOUND',
        message: 'Medicine item not found in this order.',
      });
      return;
    }

    await db.transaction(async (tx) => {
      if (decision === 'skip') {
        // Mark item as skipped
        await tx
          .update(orderItems)
          .set({
            status: 'skipped',
            notes: (item.notes ? `${item.notes} | ` : '') + '[Customer decision: skip]',
            updatedAt: new Date(),
          })
          .where(eq(orderItems.id, itemId));

        await tx.insert(orderStatusEvents).values({
          orderId: order.id,
          status: order.status,
          actorType: 'customer',
          actorId: order.customerId,
          notes: `Customer chose to skip unavailable item: ${item.name}`,
          metadata: { itemId, decision: 'skip' },
        });
      } else if (decision === 'call_me') {
        // Record call request
        await tx
          .update(orderItems)
          .set({
            notes: (item.notes ? `${item.notes} | ` : '') + '[Customer decision: call_me]',
            updatedAt: new Date(),
          })
          .where(eq(orderItems.id, itemId));

        await tx.insert(orderStatusEvents).values({
          orderId: order.id,
          status: order.status,
          actorType: 'customer',
          actorId: order.customerId,
          notes: `Customer requested a phone call regarding unavailable medicine: ${item.name}`,
          metadata: { itemId, decision: 'call_me', callRequested: true },
        });
      } else if (decision === 'cancel') {
        // Cancel the order
        await tx
          .update(orders)
          .set({
            status: 'cancelled',
            cancelReason: `Customer cancelled order because ${item.name} was unavailable`,
            updatedAt: new Date(),
          })
          .where(eq(orders.id, order.id));

        await tx
          .update(orderItems)
          .set({
            notes: (item.notes ? `${item.notes} | ` : '') + '[Customer decision: cancel_order]',
            updatedAt: new Date(),
          })
          .where(eq(orderItems.id, itemId));

        await tx.insert(orderStatusEvents).values({
          orderId: order.id,
          status: 'cancelled',
          actorType: 'customer',
          actorId: order.customerId,
          notes: `Customer cancelled order because ${item.name} was unavailable at pharmacy`,
          metadata: { itemId, decision: 'cancel' },
        });
      }
    });

    res.status(200).json({
      success: true,
      decision,
      message: 'Your decision has been updated.',
    });
  } catch (err) {
    console.error('Error handling item decision:', err);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'Failed to record item decision. Please try again.',
    });
  }
});

/**
 * POST /api/v1/track/:token/rating
 * Submits 1-5 star rating and optional comment (up to 300 characters).
 * Allowed ONLY for delivered orders.
 */
router.post('/:token/rating', async (req: Request, res: Response): Promise<void> => {
  const tokenParam = req.params.token;
  const token = (Array.isArray(tokenParam) ? tokenParam[0] : tokenParam) || '';

  const parsed = RatingSchema.safeParse(req.body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: firstIssue?.message || 'Invalid rating parameters.',
    });
    return;
  }

  const { stars, comment } = parsed.data;

  try {
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.trackingToken, token))
      .limit(1);

    if (!order) {
      res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'We could not find this order. Check the number and try again.',
      });
      return;
    }

    // Rating allowed ONLY on delivered orders
    if (order.status !== 'delivered') {
      res.status(400).json({
        success: false,
        error: 'ORDER_NOT_DELIVERED',
        message: 'Ratings can only be submitted for delivered orders.',
      });
      return;
    }

    await db
      .insert(orderRatings)
      .values({
        orderId: order.id,
        customerId: order.customerId,
        rating: stars,
        comment: comment || null,
      })
      .onConflictDoUpdate({
        target: orderRatings.orderId,
        set: {
          rating: stars,
          comment: comment || null,
          updatedAt: new Date(),
        },
      });

    res.status(200).json({
      success: true,
      message: 'Thank you for rating your delivery!',
    });
  } catch (err) {
    console.error('Error submitting order rating:', err);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'Failed to save rating. Please try again.',
    });
  }
});

export default router;
