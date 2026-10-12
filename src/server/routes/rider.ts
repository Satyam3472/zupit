import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import {
  orders,
  riders,
  orderItems,
  prescriptions,
  bills,
  payments,
  orderStatusEvents,
  riderCashLedger,
} from '../db/schema.js';
import { eq, and, sql, desc, inArray } from 'drizzle-orm';
import { requireRiderApi } from '../middleware/auth.js';
import { settingsService } from '../services/settingsService.js';
import crypto from 'crypto';
import path from 'path';

const router = Router();

// Protect all /api/v1/rider routes with rider authentication
router.use(requireRiderApi);

/**
 * GET /api/v1/rider/me
 * Returns authenticated rider's profile and current online status
 */
router.get('/me', async (req: Request, res: Response): Promise<void> => {
  const riderId = req.rider!.userId;

  const [rider] = await db
    .select({
      id: riders.id,
      name: riders.name,
      phone: riders.phone,
      status: riders.status,
      vehicleType: riders.vehicleType,
      vehicleNumber: riders.vehicleNumber,
      cashBalance: riders.cashBalance,
      isOnline: riders.isOnline,
      lastActiveAt: riders.lastActiveAt,
    })
    .from(riders)
    .where(eq(riders.id, riderId))
    .limit(1);

  if (!rider) {
    res.status(404).json({
      success: false,
      error: 'RIDER_NOT_FOUND',
      message: 'Rider account not found.',
    });
    return;
  }

  res.status(200).json({
    success: true,
    rider,
  });
});

/**
 * POST /api/v1/rider/status
 * Toggle online / offline state
 */
router.post('/status', async (req: Request, res: Response): Promise<void> => {
  const riderId = req.rider!.userId;
  const { isOnline } = req.body;

  if (typeof isOnline !== 'boolean') {
    res.status(400).json({
      success: false,
      error: 'INVALID_PAYLOAD',
      message: 'isOnline must be a boolean.',
    });
    return;
  }

  const [rider] = await db
    .select()
    .from(riders)
    .where(eq(riders.id, riderId))
    .limit(1);

  if (!rider) {
    res.status(404).json({ success: false, error: 'RIDER_NOT_FOUND' });
    return;
  }

  if (rider.status !== 'approved') {
    res.status(403).json({
      success: false,
      error: 'NOT_APPROVED',
      message: 'Only approved riders can go online.',
    });
    return;
  }

  const [updated] = await db
    .update(riders)
    .set({
      isOnline,
      lastActiveAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(riders.id, riderId))
    .returning();

  res.status(200).json({
    success: true,
    isOnline: updated.isOnline,
    message: updated.isOnline ? 'You are now Online' : 'You are now Offline',
  });
});

/**
 * GET /api/v1/rider/home
 * Returns:
 * - isOnline status
 * - Today's counts (completed orders, active orders, today's cash spent, cash collected)
 * - Open order list (polled every 8s by online riders)
 * - Any currently active order assigned to this rider
 */
router.get('/home', async (req: Request, res: Response): Promise<void> => {
  const riderId = req.rider!.userId;

  const [rider] = await db
    .select()
    .from(riders)
    .where(eq(riders.id, riderId))
    .limit(1);

  if (!rider) {
    res.status(404).json({ success: false, error: 'RIDER_NOT_FOUND' });
    return;
  }

  // Calculate start of today (midnight)
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  // 1. Get today's completed orders count
  const completedTodayRes = await db.execute(sql`
    SELECT COUNT(*)::int as count
    FROM orders
    WHERE rider_id = ${riderId}
      AND status = 'delivered'
      AND updated_at >= ${startOfDay}
  `);
  const ordersDone = (completedTodayRes.rows[0] as { count: number })?.count || 0;

  // 2. Check for currently active order assigned to this rider
  const [activeOrderRow] = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      status: orders.status,
      deliveryName: orders.deliveryName,
      deliveryPhone: orders.deliveryPhone,
      deliveryAddress: orders.deliveryAddress,
      deliveryLandmark: orders.deliveryLandmark,
      finalAmount: orders.finalAmount,
      totalAmount: orders.totalAmount,
      paymentMethod: orders.paymentMethod,
      paymentStatus: orders.paymentStatus,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(
      and(
        eq(orders.riderId, riderId),
        inArray(orders.status, ['rider_assigned', 'buying', 'out_for_delivery'])
      )
    )
    .limit(1);

  // 3. Today's ledger sums
  const ledgerTodayRes = await db.execute(sql`
    SELECT
      COALESCE(SUM(CASE WHEN type = 'purchase_spent' THEN ABS(amount::numeric) ELSE 0 END), 0) as spent,
      COALESCE(SUM(CASE WHEN type = 'cash_collected' THEN amount::numeric ELSE 0 END), 0) as collected
    FROM rider_cash_ledger
    WHERE rider_id = ${riderId}
      AND created_at >= ${startOfDay}
  `);
  const spentToday = Number((ledgerTodayRes.rows[0] as { spent: string })?.spent || 0);
  const collectedToday = Number((ledgerTodayRes.rows[0] as { collected: string })?.collected || 0);

  // If rider is offline or not approved, do not return open orders
  if (!rider.isOnline || rider.status !== 'approved') {
    res.status(200).json({
      success: true,
      isOnline: rider.isOnline,
      riderStatus: rider.status,
      counts: {
        ordersDone,
        activeOrders: activeOrderRow ? 1 : 0,
        spentToday,
        collectedToday,
        cashBalance: Number(rider.cashBalance || 0),
      },
      openOrders: [],
      activeOrder: activeOrderRow || null,
    });
    return;
  }

  // 4. Fetch open orders (placed and no rider assigned)
  // Include medicine count and prescription count
  const openOrdersRows = await db.execute(sql`
    SELECT
      o.id,
      o.order_number as "orderNumber",
      o.delivery_address as "deliveryAddress",
      o.delivery_landmark as "deliveryLandmark",
      o.delivery_pincode as "deliveryPincode",
      o.status,
      o.created_at as "createdAt",
      (SELECT COUNT(*)::int FROM order_items oi WHERE oi.order_id = o.id) as "itemCount",
      (SELECT COUNT(*)::int FROM prescriptions p WHERE p.order_id = o.id) as "prescriptionCount"
    FROM orders o
    WHERE o.status = 'placed'
      AND o.rider_id IS NULL
    ORDER BY o.created_at ASC
    LIMIT 20
  `);

  const openOrders = (openOrdersRows.rows as any[]).map((row, index) => {
    // Generate an estimated distance relative to Jamui Sadar hub
    const simulatedDistances = ['1.2 km', '1.8 km', '2.4 km', '3.1 km', '0.8 km'];
    const distance = simulatedDistances[index % simulatedDistances.length];

    // Extract area from address or pincode
    const area = row.deliveryLandmark
      ? `${row.deliveryLandmark}, Jamui`
      : row.deliveryAddress.split(',')[0] || 'Jamui Town';

    return {
      id: row.id,
      orderNumber: row.orderNumber,
      area,
      deliveryAddress: row.deliveryAddress,
      deliveryLandmark: row.deliveryLandmark,
      itemCount: Number(row.itemCount || 0),
      hasPrescription: Number(row.prescriptionCount || 0) > 0,
      prescriptionCount: Number(row.prescriptionCount || 0),
      distance,
      createdAt: row.createdAt,
    };
  });

  res.status(200).json({
    success: true,
    isOnline: true,
    riderStatus: rider.status,
    counts: {
      ordersDone,
      activeOrders: activeOrderRow ? 1 : 0,
      spentToday,
      collectedToday,
      cashBalance: Number(rider.cashBalance || 0),
    },
    openOrders,
    activeOrder: activeOrderRow || null,
  });
});

/**
 * POST /api/v1/rider/orders/:orderId/accept
 * Atomic statement:
 * UPDATE orders SET rider_id = $1, status = 'rider_assigned', assigned_at = now()
 * WHERE id = $2 AND rider_id IS NULL AND status = 'placed'
 * Zero rows returns 409 'Taken by another rider'
 */
router.post('/orders/:orderId/accept', async (req: Request, res: Response): Promise<void> => {
  const riderId = req.rider!.userId;
  const orderIdParam = req.params.orderId;
  const orderId = (Array.isArray(orderIdParam) ? orderIdParam[0] : orderIdParam) || '';

  const [rider] = await db
    .select()
    .from(riders)
    .where(eq(riders.id, riderId))
    .limit(1);

  if (!rider || rider.status !== 'approved') {
    res.status(403).json({
      success: false,
      error: 'RIDER_NOT_APPROVED',
      message: 'Only approved riders can accept orders.',
    });
    return;
  }

  // Atomic update
  const result = await db.execute(sql`
    UPDATE orders
    SET rider_id = ${riderId},
        status = 'rider_assigned',
        assigned_at = now(),
        updated_at = now()
    WHERE id = ${orderId}
      AND rider_id IS NULL
      AND status = 'placed'
    RETURNING id, order_number, status, assigned_at
  `);

  if (!result.rows || result.rows.length === 0) {
    res.status(409).json({
      success: false,
      error: 'TAKEN_BY_ANOTHER_RIDER',
      message: 'Taken by another rider',
    });
    return;
  }

  const acceptedOrder = result.rows[0];

  // Record timeline event
  await db.insert(orderStatusEvents).values({
    orderId,
    status: 'rider_assigned',
    actorType: 'rider',
    actorId: riderId,
    notes: `Accepted by rider ${rider.name}`,
  });

  res.status(200).json({
    success: true,
    message: 'Order accepted successfully.',
    order: acceptedOrder,
  });
});

/**
 * GET /api/v1/rider/orders/:orderId
 * Order detail view:
 * Customer info, landmark, items, prescriptions, uploaded bills, settings, past pharmacies
 */
router.get('/orders/:orderId', async (req: Request, res: Response): Promise<void> => {
  const riderId = req.rider!.userId;
  const orderIdParam = req.params.orderId;
  const orderId = (Array.isArray(orderIdParam) ? orderIdParam[0] : orderIdParam) || '';

  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) {
    res.status(404).json({
      success: false,
      error: 'ORDER_NOT_FOUND',
      message: 'Order not found.',
    });
    return;
  }

  // Get items
  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  // Get prescriptions
  const prescriptionList = await db
    .select()
    .from(prescriptions)
    .where(eq(prescriptions.orderId, orderId));

  // Get uploaded bills
  const billList = await db
    .select()
    .from(bills)
    .where(eq(bills.orderId, orderId))
    .orderBy(desc(bills.createdAt));

  // Get distinct pharmacy names previously used by this rider
  const pharmacyRows = await db.execute(sql`
    SELECT DISTINCT pharmacy_name as "name"
    FROM bills
    WHERE rider_id = ${riderId}
      AND pharmacy_name IS NOT NULL
      AND TRIM(pharmacy_name) != ''
    LIMIT 8
  `);
  const pastPharmacies = (pharmacyRows.rows as { name: string }[]).map((r) => r.name);

  // Platform settings
  const platformSettings = await settingsService.getAll();

  res.status(200).json({
    success: true,
    order: {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      deliveryName: order.deliveryName,
      deliveryPhone: order.deliveryPhone,
      deliveryAddress: order.deliveryAddress,
      deliveryLandmark: order.deliveryLandmark,
      deliveryPincode: order.deliveryPincode,
      notes: order.notes,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      billTotal: order.billTotal ? Number(order.billTotal) : null,
      finalAmount: order.finalAmount ? Number(order.finalAmount) : null,
      deliveryFee: Number(order.deliveryFee || 0),
      totalAmount: Number(order.totalAmount || 0),
      deliveryCodeAttempts: order.deliveryCodeAttempts,
      createdAt: order.createdAt,
      assignedAt: order.assignedAt,
    },
    items,
    prescriptions: prescriptionList,
    bills: billList,
    suggestedPharmacies: pastPharmacies.length > 0 ? pastPharmacies : [
      'Jan Aushadhi Kendra, Station Road',
      'Maa Tara Medical, Hospital More',
      'Gupta Pharmacy, Jamui Bazaar',
      'Life Care Medicos, Bypass',
    ],
    settings: {
      bill_confirm_threshold: platformSettings.bill_confirm_threshold,
      delivery_fee: platformSettings.delivery_fee,
      service_fee: platformSettings.service_fee,
      otp_max_attempts: platformSettings.otp_max_attempts,
    },
  });
});

/**
 * POST /api/v1/rider/orders/:orderId/start-buying
 * Transitions order from rider_assigned to buying
 */
router.post('/orders/:orderId/start-buying', async (req: Request, res: Response): Promise<void> => {
  const riderId = req.rider!.userId;
  const orderIdParam = req.params.orderId;
  const orderId = (Array.isArray(orderIdParam) ? orderIdParam[0] : orderIdParam) || '';

  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) {
    res.status(404).json({ success: false, error: 'ORDER_NOT_FOUND' });
    return;
  }

  if (order.riderId !== riderId) {
    res.status(403).json({ success: false, error: 'NOT_ASSIGNED_RIDER' });
    return;
  }

  if (order.status !== 'rider_assigned' && order.status !== 'buying') {
    res.status(400).json({
      success: false,
      error: 'INVALID_STATUS',
      message: `Cannot start buying from status '${order.status}'.`,
    });
    return;
  }

  await db
    .update(orders)
    .set({
      status: 'buying',
      updatedAt: new Date(),
    })
    .where(eq(orders.id, orderId));

  await db.insert(orderStatusEvents).values({
    orderId,
    status: 'buying',
    actorType: 'rider',
    actorId: riderId,
    notes: 'Rider started buying medicines at pharmacy',
  });

  res.status(200).json({
    success: true,
    status: 'buying',
    message: 'Status updated to buying.',
  });
});

/**
 * POST /api/v1/rider/orders/:orderId/items/:itemId/status
 * Toggle item status: 'bought' | 'unavailable' | 'pending'
 */
router.post('/orders/:orderId/items/:itemId/status', async (req: Request, res: Response): Promise<void> => {
  const riderId = req.rider!.userId;
  const orderIdParam = req.params.orderId;
  const orderId = (Array.isArray(orderIdParam) ? orderIdParam[0] : orderIdParam) || '';
  const itemIdParam = req.params.itemId;
  const itemId = (Array.isArray(itemIdParam) ? itemIdParam[0] : itemIdParam) || '';
  const { status, notes } = req.body;

  if (!['bought', 'unavailable', 'pending'].includes(status)) {
    res.status(400).json({
      success: false,
      error: 'INVALID_STATUS',
      message: "Status must be 'bought', 'unavailable', or 'pending'.",
    });
    return;
  }

  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order || order.riderId !== riderId) {
    res.status(403).json({ success: false, error: 'UNAUTHORIZED' });
    return;
  }

  const [updatedItem] = await db
    .update(orderItems)
    .set({
      status,
      notes: notes !== undefined ? notes : undefined,
      updatedAt: new Date(),
    })
    .where(and(eq(orderItems.id, itemId), eq(orderItems.orderId, orderId)))
    .returning();

  res.status(200).json({
    success: true,
    item: updatedItem,
  });
});

/**
 * POST /api/v1/rider/orders/:orderId/bills
 * Add a bill for an order (allows multiple bills per order)
 */
const AddBillSchema = z.object({
  pharmacyName: z.string().min(1, 'Pharmacy name is required'),
  billNumber: z.string().optional(),
  billImageUrl: z.string().min(1, 'Bill image URL is required'),
  amount: z.coerce.number().min(0.01, 'Bill amount must be greater than zero'),
});

router.post('/orders/:orderId/bills', async (req: Request, res: Response): Promise<void> => {
  const riderId = req.rider!.userId;
  const orderIdParam = req.params.orderId;
  const orderId = (Array.isArray(orderIdParam) ? orderIdParam[0] : orderIdParam) || '';

  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order || order.riderId !== riderId) {
    res.status(403).json({ success: false, error: 'UNAUTHORIZED' });
    return;
  }

  const parsed = AddBillSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: parsed.error.issues[0]?.message || 'Invalid bill details.',
    });
    return;
  }

  const { pharmacyName, billNumber, billImageUrl, amount } = parsed.data;

  const [insertedBill] = await db
    .insert(bills)
    .values({
      orderId,
      riderId,
      pharmacyName,
      billNumber: billNumber || null,
      billImageUrl,
      amount: amount.toFixed(2),
    })
    .returning();

  // Return all current bills and total
  const allBills = await db
    .select()
    .from(bills)
    .where(eq(bills.orderId, orderId));

  const totalBillAmount = allBills.reduce((sum, b) => sum + Number(b.amount), 0);

  res.status(200).json({
    success: true,
    bill: insertedBill,
    allBills,
    totalBillAmount,
  });
});

/**
 * DELETE /api/v1/rider/orders/:orderId/bills/:billId
 * Delete a bill prior to submitting to delivery
 */
router.delete('/orders/:orderId/bills/:billId', async (req: Request, res: Response): Promise<void> => {
  const riderId = req.rider!.userId;
  const orderIdParam = req.params.orderId;
  const orderId = (Array.isArray(orderIdParam) ? orderIdParam[0] : orderIdParam) || '';
  const billIdParam = req.params.billId;
  const billId = (Array.isArray(billIdParam) ? billIdParam[0] : billIdParam) || '';

  await db
    .delete(bills)
    .where(and(eq(bills.id, billId), eq(bills.orderId, orderId), eq(bills.riderId, riderId)));

  const remainingBills = await db
    .select()
    .from(bills)
    .where(eq(bills.orderId, orderId));

  const totalBillAmount = remainingBills.reduce((sum, b) => sum + Number(b.amount), 0);

  res.status(200).json({
    success: true,
    allBills: remainingBills,
    totalBillAmount,
  });
});

/**
 * POST /api/v1/rider/orders/:orderId/submit-bills
 * Sets bill_total and final_amount (bill_total + delivery_fee + service_fee from settings),
 * writes a negative purchase_spent ledger entry per bill,
 * and moves status to out_for_delivery.
 */
router.post('/orders/:orderId/submit-bills', async (req: Request, res: Response): Promise<void> => {
  const riderId = req.rider!.userId;
  const orderIdParam = req.params.orderId;
  const orderId = (Array.isArray(orderIdParam) ? orderIdParam[0] : orderIdParam) || '';
  const { customerConfirmedByCall } = req.body;

  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order || order.riderId !== riderId) {
    res.status(403).json({ success: false, error: 'UNAUTHORIZED' });
    return;
  }

  // Fetch all bills for this order
  const orderBills = await db
    .select()
    .from(bills)
    .where(eq(bills.orderId, orderId));

  if (orderBills.length === 0) {
    res.status(400).json({
      success: false,
      error: 'NO_BILLS_UPLOADED',
      message: 'Please upload at least one pharmacy bill before continuing.',
    });
    return;
  }

  const billTotal = orderBills.reduce((sum, b) => sum + Number(b.amount), 0);

  // Settings
  const platformSettings = await settingsService.getAll();
  const threshold = platformSettings.bill_confirm_threshold;

  if (billTotal > threshold && !customerConfirmedByCall) {
    res.status(400).json({
      success: false,
      error: 'CONFIRMATION_REQUIRED',
      message: `Total bill (₹${billTotal.toFixed(2)}) exceeds ₹${threshold}. Customer confirmation by phone call is required.`,
    });
    return;
  }

  const deliveryFee = platformSettings.delivery_fee;
  const serviceFee = platformSettings.service_fee;
  const finalAmount = billTotal + deliveryFee + serviceFee;

  // Retrieve current rider
  const [currentRider] = await db
    .select()
    .from(riders)
    .where(eq(riders.id, riderId))
    .limit(1);

  let currentCashBalance = Number(currentRider?.cashBalance || 0);

  // Write negative purchase_spent ledger entry per bill and update rider cash balance
  for (const bill of orderBills) {
    const billAmt = Number(bill.amount);
    currentCashBalance = currentCashBalance - billAmt;

    await db.insert(riderCashLedger).values({
      riderId,
      orderId,
      type: 'purchase_spent',
      amount: (-billAmt).toFixed(2),
      balanceAfter: currentCashBalance.toFixed(2),
      notes: `Medicines purchased at ${bill.pharmacyName || 'Pharmacy'} (Bill #${bill.billNumber || 'N/A'})`,
    });
  }

  // Update rider balance in riders table
  await db
    .update(riders)
    .set({
      cashBalance: currentCashBalance.toFixed(2),
      updatedAt: new Date(),
    })
    .where(eq(riders.id, riderId));

  // Update order to out_for_delivery
  const [updatedOrder] = await db
    .update(orders)
    .set({
      billTotal: billTotal.toFixed(2),
      finalAmount: finalAmount.toFixed(2),
      subtotalAmount: billTotal.toFixed(2),
      deliveryFee: deliveryFee.toFixed(2),
      totalAmount: finalAmount.toFixed(2),
      status: 'out_for_delivery',
      updatedAt: new Date(),
    })
    .where(eq(orders.id, orderId))
    .returning();

  // Log timeline event
  await db.insert(orderStatusEvents).values({
    orderId,
    status: 'out_for_delivery',
    actorType: 'rider',
    actorId: riderId,
    notes: `Bills confirmed (₹${billTotal.toFixed(2)}). Out for delivery with rider.`,
    metadata: {
      billTotal,
      finalAmount,
      deliveryFee,
      serviceFee,
    },
  });

  res.status(200).json({
    success: true,
    message: 'Order is now out for delivery.',
    billTotal,
    finalAmount,
    status: updatedOrder.status,
  });
});

/**
 * POST /api/v1/rider/orders/:orderId/verify-delivery
 * Delivery completion:
 * Amount to collect in large digits, 'Cash collected' or 'Paid online',
 * 4-digit delivery code verification with attempt limit.
 * On success: moves to delivered, payment row for cash, positive cash_collected ledger entry.
 */
router.post('/orders/:orderId/verify-delivery', async (req: Request, res: Response): Promise<void> => {
  const riderId = req.rider!.userId;
  const orderIdParam = req.params.orderId;
  const orderId = (Array.isArray(orderIdParam) ? orderIdParam[0] : orderIdParam) || '';
  const { deliveryCode, paymentMethodSelected } = req.body;

  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order || order.riderId !== riderId) {
    res.status(403).json({ success: false, error: 'UNAUTHORIZED' });
    return;
  }

  if (order.status !== 'out_for_delivery') {
    res.status(400).json({
      success: false,
      error: 'INVALID_STATUS',
      message: `Order must be 'out_for_delivery' to complete. Current: '${order.status}'.`,
    });
    return;
  }

  const platformSettings = await settingsService.getAll();
  const maxAttempts = platformSettings.otp_max_attempts || 5;

  // Check attempt limit
  if (order.deliveryCodeAttempts >= maxAttempts) {
    res.status(429).json({
      success: false,
      error: 'ATTEMPTS_EXCEEDED',
      message: 'Maximum delivery code attempts exceeded. Please contact the Jamui hub ops admin.',
    });
    return;
  }

  // Validate 4-digit code
  const cleanEnteredCode = String(deliveryCode || '').trim();
  const cleanExpectedCode = String(order.deliveryCode || '').trim();

  if (!cleanEnteredCode || cleanEnteredCode.length !== 4 || cleanEnteredCode !== cleanExpectedCode) {
    const newAttempts = order.deliveryCodeAttempts + 1;
    await db
      .update(orders)
      .set({
        deliveryCodeAttempts: newAttempts,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId));

    const remaining = Math.max(0, maxAttempts - newAttempts);

    res.status(400).json({
      success: false,
      error: 'INVALID_CODE',
      message: `Incorrect delivery code. ${remaining} attempt(s) remaining. Ask the customer for the 4-digit code shown on their tracking page.`,
      attemptsRemaining: remaining,
    });
    return;
  }

  // Code verified! Now verify payment
  const amountToCollect = Number(order.finalAmount || order.totalAmount || 0);

  if (paymentMethodSelected === 'online') {
    if (order.paymentStatus !== 'paid') {
      res.status(400).json({
        success: false,
        error: 'PAYMENT_PENDING',
        message: 'Online payment has not been received yet. Please ask customer to tap Pay Now or choose Cash to collect ₹' + amountToCollect.toFixed(2),
      });
      return;
    }
  } else {
    // Cash payment: create payment record and ledger entry
    await db.insert(payments).values({
      orderId,
      amount: amountToCollect.toFixed(2),
      paymentMethod: 'cod',
      status: 'paid',
      paidAt: new Date(),
    });

    // Update rider cash balance and write positive cash_collected ledger entry
    const [currentRider] = await db
      .select()
      .from(riders)
      .where(eq(riders.id, riderId))
      .limit(1);

    const prevBalance = Number(currentRider?.cashBalance || 0);
    const newBalance = prevBalance + amountToCollect;

    await db.insert(riderCashLedger).values({
      riderId,
      orderId,
      type: 'cash_collected',
      amount: amountToCollect.toFixed(2),
      balanceAfter: newBalance.toFixed(2),
      notes: `Cash collected from customer for order ${order.orderNumber}`,
    });

    await db
      .update(riders)
      .set({
        cashBalance: newBalance.toFixed(2),
        updatedAt: new Date(),
      })
      .where(eq(riders.id, riderId));
  }

  // Update order to delivered
  await db
    .update(orders)
    .set({
      status: 'delivered',
      paymentStatus: 'paid',
      updatedAt: new Date(),
    })
    .where(eq(orders.id, orderId));

  // Timeline event
  await db.insert(orderStatusEvents).values({
    orderId,
    status: 'delivered',
    actorType: 'rider',
    actorId: riderId,
    notes: `Order delivered to ${order.deliveryName}. Verified with 4-digit code. ${paymentMethodSelected === 'online' ? 'Online payment verified.' : 'Cash collected: ₹' + amountToCollect.toFixed(2)}`,
  });

  res.status(200).json({
    success: true,
    message: 'Order delivered successfully!',
    orderNumber: order.orderNumber,
  });
});

/**
 * POST /api/v1/rider/orders/:orderId/fail-delivery
 * Opens a reason list and moves status to delivery_failed
 */
router.post('/orders/:orderId/fail-delivery', async (req: Request, res: Response): Promise<void> => {
  const riderId = req.rider!.userId;
  const orderIdParam = req.params.orderId;
  const orderId = (Array.isArray(orderIdParam) ? orderIdParam[0] : orderIdParam) || '';
  const { reason } = req.body;

  if (!reason || typeof reason !== 'string') {
    res.status(400).json({
      success: false,
      error: 'REASON_REQUIRED',
      message: 'Please select a reason for delivery failure.',
    });
    return;
  }

  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order || order.riderId !== riderId) {
    res.status(403).json({ success: false, error: 'UNAUTHORIZED' });
    return;
  }

  await db
    .update(orders)
    .set({
      status: 'delivery_failed',
      cancelReason: reason,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, orderId));

  await db.insert(orderStatusEvents).values({
    orderId,
    status: 'delivery_failed',
    actorType: 'rider',
    actorId: riderId,
    notes: `Delivery failed: ${reason}`,
  });

  res.status(200).json({
    success: true,
    status: 'delivery_failed',
    message: 'Order marked as delivery failed.',
  });
});

/**
 * GET /api/v1/rider/summary
 * Orders done, money spent, cash collected, balance (sum of ledger), and the day's order list
 */
router.get('/summary', async (req: Request, res: Response): Promise<void> => {
  const riderId = req.rider!.userId;

  const [rider] = await db
    .select()
    .from(riders)
    .where(eq(riders.id, riderId))
    .limit(1);

  if (!rider) {
    res.status(404).json({ success: false, error: 'RIDER_NOT_FOUND' });
    return;
  }

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  // Today's ledger transactions
  const ledgerRows = await db
    .select()
    .from(riderCashLedger)
    .where(and(eq(riderCashLedger.riderId, riderId), sql`${riderCashLedger.createdAt} >= ${startOfDay}`))
    .orderBy(desc(riderCashLedger.createdAt));

  // Calculate money spent and cash collected from ledger
  let moneySpent = 0;
  let cashCollected = 0;
  for (const entry of ledgerRows) {
    const num = Number(entry.amount);
    if (entry.type === 'purchase_spent') {
      moneySpent += Math.abs(num);
    } else if (entry.type === 'cash_collected') {
      cashCollected += num;
    }
  }

  // Today's orders list assigned to this rider
  const todayOrders = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      deliveryName: orders.deliveryName,
      deliveryAddress: orders.deliveryAddress,
      deliveryLandmark: orders.deliveryLandmark,
      status: orders.status,
      finalAmount: orders.finalAmount,
      totalAmount: orders.totalAmount,
      paymentMethod: orders.paymentMethod,
      paymentStatus: orders.paymentStatus,
      createdAt: orders.createdAt,
      updatedAt: orders.updatedAt,
    })
    .from(orders)
    .where(and(eq(orders.riderId, riderId), sql`${orders.updatedAt} >= ${startOfDay}`))
    .orderBy(desc(orders.updatedAt));

  const ordersDoneCount = todayOrders.filter((o) => o.status === 'delivered').length;

  res.status(200).json({
    success: true,
    summary: {
      ordersDone: ordersDoneCount,
      moneySpent,
      cashCollected,
      balance: Number(rider.cashBalance || 0),
      todayOrders,
      ledger: ledgerRows,
    },
  });
});

export default router;
