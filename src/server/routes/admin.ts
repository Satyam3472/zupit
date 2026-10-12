import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { eq, and, sql, desc, inArray, gte, lte, or, ilike } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  orders,
  orderItems,
  prescriptions,
  bills,
  payments,
  orderStatusEvents,
  riders,
  admins,
  customers,
  addresses,
  riderCashLedger,
  messageTemplates,
  serviceableAreas,
  auditLogs,
} from '../db/schema.js';
import { requireAdminApi, requireRole } from '../middleware/auth.js';
import { settingsService } from '../services/settingsService.js';
import { auditService } from '../services/auditService.js';

const router = Router();

function getParam(param: string | string[] | undefined): string {
  if (Array.isArray(param)) return param[0] || '';
  return param || '';
}

// Protect all admin routes with requireAdminApi
router.use(requireAdminApi);

/* ==========================================================================
   1. ORDERS ENDPOINTS
   ========================================================================== */

/**
 * GET /api/v1/admin/orders
 * Filter by status (multi-select), date range, rider, search by phone or order number.
 * Calculates waiting time against accept_timeout_minutes for amber border alert.
 * Server-side pagination of 25.
 */
router.get('/orders', async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string || '25', 10)));
    const offset = (page - 1) * limit;

    const statusParam = req.query.status as string; // comma-separated or empty
    const riderParam = req.query.riderId as string;
    const startDateParam = req.query.startDate as string;
    const endDateParam = req.query.endDate as string;
    const searchParam = (req.query.search as string || '').trim();

    const currentSettings = await settingsService.getAll();
    const acceptTimeoutMinutes = currentSettings.accept_timeout_minutes || 5;

    // Build conditions
    const conditions: any[] = [];

    if (statusParam && statusParam !== 'all') {
      const statusList = statusParam.split(',').map((s) => s.trim()).filter(Boolean);
      if (statusList.length > 0) {
        conditions.push(inArray(orders.status, statusList as any));
      }
    }

    if (riderParam) {
      if (riderParam === 'unassigned') {
        conditions.push(sql`${orders.riderId} IS NULL`);
      } else if (riderParam !== 'all') {
        conditions.push(eq(orders.riderId, riderParam));
      }
    }

    if (startDateParam) {
      const start = new Date(startDateParam);
      if (!isNaN(start.getTime())) {
        conditions.push(gte(orders.createdAt, start));
      }
    }

    if (endDateParam) {
      const end = new Date(endDateParam);
      if (!isNaN(end.getTime())) {
        end.setHours(23, 59, 59, 999);
        conditions.push(lte(orders.createdAt, end));
      }
    }

    if (searchParam) {
      const cleanPhone = searchParam.replace(/\D/g, '');
      const searchConditions = [
        ilike(orders.orderNumber, `%${searchParam}%`),
        ilike(orders.deliveryName, `%${searchParam}%`),
      ];
      if (cleanPhone.length >= 3) {
        searchConditions.push(ilike(orders.deliveryPhone, `%${cleanPhone}%`));
      }
      conditions.push(or(...searchConditions));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Total count query
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(orders)
      .where(whereClause);
    const total = Number(countResult?.count || 0);

    // Orders query
    const orderRows = await db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        status: orders.status,
        source: orders.source,
        paymentMethod: orders.paymentMethod,
        paymentStatus: orders.paymentStatus,
        subtotalAmount: orders.subtotalAmount,
        billTotal: orders.billTotal,
        finalAmount: orders.finalAmount,
        deliveryFee: orders.deliveryFee,
        totalAmount: orders.totalAmount,
        deliveryName: orders.deliveryName,
        deliveryPhone: orders.deliveryPhone,
        deliveryAddress: orders.deliveryAddress,
        deliveryLandmark: orders.deliveryLandmark,
        deliveryPincode: orders.deliveryPincode,
        deliveryCode: orders.deliveryCode,
        notes: orders.notes,
        cancelReason: orders.cancelReason,
        riderId: orders.riderId,
        customerId: orders.customerId,
        assignedAt: orders.assignedAt,
        createdAt: orders.createdAt,
        updatedAt: orders.updatedAt,
      })
      .from(orders)
      .where(whereClause)
      .orderBy(desc(orders.createdAt))
      .limit(limit)
      .offset(offset);

    // Fetch related riders for assigned rider info
    const allRiderIds = Array.from(new Set(orderRows.map((o) => o.riderId).filter(Boolean))) as string[];
    const riderMap = new Map<string, { id: string; name: string; phone: string }>();
    if (allRiderIds.length > 0) {
      const riderRecords = await db
        .select({ id: riders.id, name: riders.name, phone: riders.phone })
        .from(riders)
        .where(inArray(riders.id, allRiderIds));
      for (const r of riderRecords) {
        riderMap.set(r.id, r);
      }
    }

    // Fetch item counts and prescription counts for each order
    const orderIds = orderRows.map((o) => o.id);
    const itemCountsMap = new Map<string, number>();
    const rxCountsMap = new Map<string, number>();

    if (orderIds.length > 0) {
      const itemsCountData = await db
        .select({
          orderId: orderItems.orderId,
          count: sql<number>`count(*)`,
        })
        .from(orderItems)
        .where(inArray(orderItems.orderId, orderIds))
        .groupBy(orderItems.orderId);
      for (const ic of itemsCountData) {
        itemCountsMap.set(ic.orderId, Number(ic.count));
      }

      const rxCountData = await db
        .select({
          orderId: prescriptions.orderId,
          count: sql<number>`count(*)`,
        })
        .from(prescriptions)
        .where(inArray(prescriptions.orderId, orderIds))
        .groupBy(prescriptions.orderId);
      for (const rc of rxCountData) {
        rxCountsMap.set(rc.orderId, Number(rc.count));
      }
    }

    // Now calculate amber alert status
    const now = new Date();
    const enrichedOrders = orderRows.map((o) => {
      const createdAt = new Date(o.createdAt);
      const minutesWaiting = Math.max(0, Math.floor((now.getTime() - createdAt.getTime()) / 60000));
      // Alert condition: status is 'placed' (waiting for rider) longer than accept_timeout_minutes
      const isOverdue = o.status === 'placed' && minutesWaiting >= acceptTimeoutMinutes;

      return {
        ...o,
        assignedRider: o.riderId ? riderMap.get(o.riderId) || null : null,
        itemsCount: itemCountsMap.get(o.id) || 0,
        prescriptionsCount: rxCountsMap.get(o.id) || 0,
        minutesWaiting,
        acceptTimeoutMinutes,
        isOverdue,
      };
    });

    // Counts by status for top filter badges
    const statusCountsRaw = await db
      .select({
        status: orders.status,
        count: sql<number>`count(*)`,
      })
      .from(orders)
      .groupBy(orders.status);

    const statusCounts: Record<string, number> = { all: total };
    for (const sc of statusCountsRaw) {
      statusCounts[sc.status] = Number(sc.count);
    }

    res.status(200).json({
      success: true,
      orders: enrichedOrders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
      statusCounts,
      acceptTimeoutMinutes,
    });
  } catch (err: any) {
    console.error('Error in GET /api/v1/admin/orders:', err);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'Failed to retrieve orders list.',
    });
  }
});

/**
 * GET /api/v1/admin/orders/:id
 * Full order detail: customer, items, prescriptions, bills, payment, timeline.
 */
router.get('/orders/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = getParam(req.params.id);

    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, id))
      .limit(1);

    if (!order) {
      res.status(404).json({ success: false, message: 'Order not found.' });
      return;
    }

    // Customer
    let customer = null;
    if (order.customerId) {
      const [c] = await db.select().from(customers).where(eq(customers.id, order.customerId)).limit(1);
      customer = c || null;
    }

    // Assigned Rider
    let assignedRider = null;
    if (order.riderId) {
      const [r] = await db.select().from(riders).where(eq(riders.id, order.riderId)).limit(1);
      assignedRider = r || null;
    }

    // Items
    const items = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, id))
      .orderBy(orderItems.createdAt);

    // Prescriptions
    const rxList = await db
      .select()
      .from(prescriptions)
      .where(eq(prescriptions.orderId, id))
      .orderBy(prescriptions.createdAt);

    // Bills
    const billList = await db
      .select()
      .from(bills)
      .where(eq(bills.orderId, id))
      .orderBy(bills.createdAt);

    // Payments
    const paymentList = await db
      .select()
      .from(payments)
      .where(eq(payments.orderId, id))
      .orderBy(payments.createdAt);

    // Timeline events
    const timeline = await db
      .select()
      .from(orderStatusEvents)
      .where(eq(orderStatusEvents.orderId, id))
      .orderBy(orderStatusEvents.createdAt);

    const isItemsEditable = order.status === 'placed' || order.status === 'rider_assigned';

    res.status(200).json({
      success: true,
      order: {
        ...order,
        customer,
        assignedRider,
        items,
        prescriptions: rxList,
        bills: billList,
        payments: paymentList,
        timeline,
        isItemsEditable,
      },
    });
  } catch (err: any) {
    console.error('Error fetching order detail:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve order details.' });
  }
});

/**
 * POST /api/v1/admin/orders/:id/view-rx
 * Mandatory Audit Log: Log each prescription view into audit_logs.
 */
router.post('/orders/:id/view-rx', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = getParam(req.params.id);
    const { rxId, rxUrl } = req.body;
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

    await auditService.log(
      { actorType: 'admin', actorId: req.admin!.userId, ipAddress: clientIp },
      'prescription_viewed',
      { type: 'prescription', id: String(rxId) },
      { orderId: id, prescriptionUrl: rxUrl, adminEmail: req.admin!.email }
    );

    res.status(200).json({ success: true, message: 'Prescription view logged.' });
  } catch (err: any) {
    console.error('Error logging prescription view:', err);
    res.status(500).json({ success: false, message: 'Failed to log prescription view.' });
  }
});

/**
 * PATCH /api/v1/admin/orders/:id/items
 * Editable items before buying status (placed or rider_assigned only).
 */
router.patch('/orders/:id/items', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = getParam(req.params.id);
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

    const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
    if (!order) {
      res.status(404).json({ success: false, message: 'Order not found.' });
      return;
    }

    if (order.status !== 'placed' && order.status !== 'rider_assigned') {
      res.status(400).json({
        success: false,
        message: `Order items cannot be edited after rider starts buying (current status: ${order.status}).`,
      });
      return;
    }

    const { items: newItems } = req.body;
    if (!Array.isArray(newItems) || newItems.length === 0) {
      res.status(400).json({ success: false, message: 'At least one medicine item is required.' });
      return;
    }

    // Atomic transaction to replace items
    await db.transaction(async (tx) => {
      // Remove existing items
      await tx.delete(orderItems).where(eq(orderItems.orderId, id));

      // Insert new items
      for (const item of newItems) {
        if (!item.name || !item.name.trim()) continue;
        await tx.insert(orderItems).values({
          orderId: id,
          name: item.name.trim(),
          strength: item.strength?.trim() || null,
          quantity: Math.max(1, parseInt(item.quantity, 10) || 1),
          unitPrice: item.unitPrice ? String(item.unitPrice) : null,
          totalPrice: item.totalPrice ? String(item.totalPrice) : null,
          notes: item.notes?.trim() || null,
          status: 'pending',
        });
      }

      // Add status event
      await tx.insert(orderStatusEvents).values({
        orderId: id,
        status: order.status,
        actorType: 'admin',
        actorId: req.admin!.userId,
        notes: `Order medicines updated by administrator (${newItems.length} items)`,
      });
    });

    await auditService.log(
      { actorType: 'admin', actorId: req.admin!.userId, ipAddress: clientIp },
      'order_items_updated',
      { type: 'order', id },
      { orderNumber: order.orderNumber, itemCount: newItems.length }
    );

    res.status(200).json({ success: true, message: 'Order items updated successfully.' });
  } catch (err: any) {
    console.error('Error updating order items:', err);
    res.status(500).json({ success: false, message: 'Failed to update order items.' });
  }
});

/**
 * POST /api/v1/admin/orders/:id/assign
 * Assign or reassign rider (approved riders, online first).
 */
router.post('/orders/:id/assign', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = getParam(req.params.id);
    const { riderId } = req.body;
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

    if (!riderId) {
      res.status(400).json({ success: false, message: 'Please select a rider to assign.' });
      return;
    }

    const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
    if (!order) {
      res.status(404).json({ success: false, message: 'Order not found.' });
      return;
    }

    const [rider] = await db.select().from(riders).where(eq(riders.id, riderId)).limit(1);
    if (!rider) {
      res.status(404).json({ success: false, message: 'Selected rider not found.' });
      return;
    }

    if (rider.status !== 'approved') {
      res.status(400).json({ success: false, message: 'Cannot assign an unapproved or blocked rider.' });
      return;
    }

    const isReassign = !!order.riderId && order.riderId !== riderId;
    const newStatus = order.status === 'placed' ? 'rider_assigned' : order.status;

    await db.transaction(async (tx) => {
      await tx
        .update(orders)
        .set({
          riderId: rider.id,
          status: newStatus,
          assignedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(orders.id, id));

      await tx.insert(orderStatusEvents).values({
        orderId: id,
        status: newStatus,
        actorType: 'admin',
        actorId: req.admin!.userId,
        notes: isReassign
          ? `Order reassigned to rider ${rider.name} (${rider.phone})`
          : `Order assigned to rider ${rider.name} (${rider.phone})`,
      });
    });

    await auditService.log(
      { actorType: 'admin', actorId: req.admin!.userId, ipAddress: clientIp },
      isReassign ? 'order_reassigned' : 'order_assigned',
      { type: 'order', id },
      { orderNumber: order.orderNumber, riderId: rider.id, riderName: rider.name }
    );

    res.status(200).json({
      success: true,
      message: `Order assigned to ${rider.name} successfully.`,
    });
  } catch (err: any) {
    console.error('Error assigning rider:', err);
    res.status(500).json({ success: false, message: 'Failed to assign rider.' });
  }
});

/**
 * POST /api/v1/admin/orders/:id/cancel
 * Cancel order with a mandatory reason.
 */
router.post('/orders/:id/cancel', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = getParam(req.params.id);
    const { reason } = req.body;
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

    if (!reason || !reason.trim()) {
      res.status(400).json({ success: false, message: 'A cancellation reason is strictly required.' });
      return;
    }

    const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
    if (!order) {
      res.status(404).json({ success: false, message: 'Order not found.' });
      return;
    }

    if (order.status === 'delivered') {
      res.status(400).json({ success: false, message: 'Delivered orders cannot be cancelled.' });
      return;
    }

    await db.transaction(async (tx) => {
      await tx
        .update(orders)
        .set({
          status: 'cancelled',
          cancelReason: reason.trim(),
          updatedAt: new Date(),
        })
        .where(eq(orders.id, id));

      await tx.insert(orderStatusEvents).values({
        orderId: id,
        status: 'cancelled',
        actorType: 'admin',
        actorId: req.admin!.userId,
        notes: `Order cancelled by Admin: ${reason.trim()}`,
      });
    });

    await auditService.log(
      { actorType: 'admin', actorId: req.admin!.userId, ipAddress: clientIp },
      'order_cancelled_by_admin',
      { type: 'order', id },
      { orderNumber: order.orderNumber, reason: reason.trim() }
    );

    res.status(200).json({ success: true, message: 'Order cancelled successfully.' });
  } catch (err: any) {
    console.error('Error cancelling order:', err);
    res.status(500).json({ success: false, message: 'Failed to cancel order.' });
  }
});

/* ==========================================================================
   2. CREATE ORDER & PHONE LOOKUP
   ========================================================================== */

/**
 * GET /api/v1/admin/customers/lookup
 * Phone lookup that fills known customer details.
 */
router.get('/customers/lookup', async (req: Request, res: Response): Promise<void> => {
  try {
    const phone = ((req.query.phone as string) || '').replace(/\D/g, '').slice(-10);
    if (phone.length !== 10) {
      res.status(400).json({ success: false, message: 'Valid 10-digit phone number is required.' });
      return;
    }

    const [customer] = await db.select().from(customers).where(eq(customers.phone, phone)).limit(1);
    if (!customer) {
      res.status(200).json({ success: true, found: false });
      return;
    }

    // Get last address used by this customer
    const [lastAddress] = await db
      .select()
      .from(addresses)
      .where(eq(addresses.customerId, customer.id))
      .orderBy(desc(addresses.createdAt))
      .limit(1);

    res.status(200).json({
      success: true,
      found: true,
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        isActive: customer.isActive,
        blockReason: customer.blockReason,
      },
      lastAddress: lastAddress || null,
    });
  } catch (err: any) {
    console.error('Error in customer lookup:', err);
    res.status(500).json({ success: false, message: 'Failed to look up customer.' });
  }
});

/**
 * POST /api/v1/admin/orders/create
 * Creates an order directly from admin with created_by_admin_id and source (phone, whatsapp).
 */
router.post('/orders/create', async (req: Request, res: Response): Promise<void> => {
  try {
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

    const schema = z.object({
      name: z.string().trim().min(2, 'Name must be at least 2 characters'),
      mobile: z
        .string()
        .trim()
        .transform((v) => v.replace(/\D/g, '').slice(-10))
        .refine((v) => /^[6-9]\d{9}$/.test(v), 'Enter valid 10-digit Indian mobile number'),
      houseArea: z.string().trim().min(3, 'House or area details are required'),
      landmark: z.string().trim().optional(),
      pincode: z
        .string()
        .trim()
        .transform((v) => v.replace(/\D/g, ''))
        .refine((v) => /^\d{6}$/.test(v), 'Pincode must be exactly 6 digits'),
      source: z.enum(['phone', 'whatsapp', 'web']).default('phone'),
      paymentMethod: z.enum(['cod', 'online']).default('cod'),
      notes: z.string().trim().optional(),
      medicines: z
        .array(
          z.object({
            name: z.string().trim().min(1),
            strength: z.string().trim().optional(),
            quantity: z.number().int().min(1).default(1),
            notes: z.string().trim().optional(),
          })
        )
        .optional()
        .default([]),
      prescriptions: z
        .array(
          z.object({
            fileUrl: z.string().min(1),
            fileType: z.string().optional(),
            notes: z.string().optional(),
          })
        )
        .optional()
        .default([]),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: parsed.error.issues[0]?.message || 'Invalid parameters',
      });
      return;
    }

    const {
      name,
      mobile: phone,
      houseArea,
      landmark,
      pincode,
      source,
      paymentMethod,
      notes,
      medicines,
      prescriptions: rxList,
    } = parsed.data;

    // Check serviceable pincode
    const [area] = await db
      .select()
      .from(serviceableAreas)
      .where(and(eq(serviceableAreas.pincode, pincode), eq(serviceableAreas.isActive, true)))
      .limit(1);

    if (!area) {
      res.status(400).json({
        success: false,
        message: `Pincode ${pincode} is not currently serviceable in Jamui hub.`,
      });
      return;
    }

    const result = await db.transaction(async (tx) => {
      // Upsert Customer
      let customerId: string;
      const [existingCustomer] = await tx.select().from(customers).where(eq(customers.phone, phone)).limit(1);
      if (existingCustomer) {
        customerId = existingCustomer.id;
        await tx.update(customers).set({ name, updatedAt: new Date() }).where(eq(customers.id, customerId));
      } else {
        const [newCustomer] = await tx
          .insert(customers)
          .values({ name, phone, isActive: true })
          .returning({ id: customers.id });
        customerId = newCustomer.id;
      }

      // Create Address
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

      // Create Order with createdByAdminId
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
          paymentMethod,
          paymentStatus: 'pending',
          notes: notes || null,
          trackingToken,
          createdByAdminId: req.admin!.userId,
        })
        .returning({
          id: orders.id,
          orderNumber: orders.orderNumber,
          trackingToken: orders.trackingToken,
        });

      // Insert Items
      for (const m of medicines) {
        await tx.insert(orderItems).values({
          orderId: newOrder.id,
          name: m.name,
          strength: m.strength || null,
          quantity: m.quantity,
          notes: m.notes || null,
          status: 'pending',
        });
      }

      // Insert Prescriptions
      for (const rx of rxList) {
        await tx.insert(prescriptions).values({
          orderId: newOrder.id,
          fileUrl: rx.fileUrl,
          fileType: rx.fileType || null,
          notes: rx.notes || null,
        });
      }

      // Initial Timeline Event
      await tx.insert(orderStatusEvents).values({
        orderId: newOrder.id,
        status: 'placed',
        actorType: 'admin',
        actorId: req.admin!.userId,
        notes: `Order created manually by Admin via ${source.toUpperCase()}`,
      });

      return newOrder;
    });

    await auditService.log(
      { actorType: 'admin', actorId: req.admin!.userId, ipAddress: clientIp },
      'order_created_by_admin',
      { type: 'order', id: result.id },
      { orderNumber: result.orderNumber, source, phone }
    );

    res.status(201).json({
      success: true,
      orderNumber: result.orderNumber,
      orderId: result.id,
      trackingToken: result.trackingToken,
      message: 'Order created successfully.',
    });
  } catch (err: any) {
    console.error('Error creating order by admin:', err);
    res.status(500).json({ success: false, message: 'Failed to create order.' });
  }
});

/* ==========================================================================
   3. RIDERS MANAGEMENT & APPROVAL QUEUE
   ========================================================================== */

/**
 * GET /api/v1/admin/riders
 * Riders list with status, approval queue, cash balances.
 */
router.get('/riders', async (req: Request, res: Response): Promise<void> => {
  try {
    const statusFilter = (req.query.status as string || 'all').trim();

    let query = db.select().from(riders);
    if (statusFilter !== 'all') {
      query = query.where(eq(riders.status, statusFilter as any)) as any;
    }

    const riderRows = await query.orderBy(desc(riders.isOnline), desc(riders.createdAt));

    // Calculate active orders count for each rider
    const activeOrderCounts = await db
      .select({
        riderId: orders.riderId,
        count: sql<number>`count(*)`,
      })
      .from(orders)
      .where(
        and(
          sql`${orders.riderId} IS NOT NULL`,
          inArray(orders.status, ['rider_assigned', 'buying', 'out_for_delivery'])
        )
      )
      .groupBy(orders.riderId);

    const activeCountMap = new Map<string, number>();
    for (const a of activeOrderCounts) {
      if (a.riderId) activeCountMap.set(a.riderId, Number(a.count));
    }

    const enriched = riderRows.map((r) => ({
      ...r,
      activeOrdersCount: activeCountMap.get(r.id) || 0,
      cashBalanceNumber: parseFloat(r.cashBalance || '0.00'),
    }));

    res.status(200).json({
      success: true,
      riders: enriched,
    });
  } catch (err: any) {
    console.error('Error fetching riders:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve riders list.' });
  }
});

/**
 * POST /api/v1/admin/riders
 * Add a new rider.
 */
router.post('/riders', async (req: Request, res: Response): Promise<void> => {
  try {
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

    const schema = z.object({
      name: z.string().trim().min(2, 'Name must be at least 2 characters'),
      phone: z
        .string()
        .trim()
        .transform((v) => v.replace(/\D/g, '').slice(-10))
        .refine((v) => /^[6-9]\d{9}$/.test(v), 'Enter valid 10-digit Indian mobile number'),
      vehicleType: z.string().trim().optional(),
      vehicleNumber: z.string().trim().optional(),
      idProofUrl: z.string().trim().optional(),
      status: z.enum(['approved', 'pending_approval']).default('approved'),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, message: parsed.error.issues[0]?.message });
      return;
    }

    const { name, phone, vehicleType, vehicleNumber, idProofUrl, status } = parsed.data;

    // Check phone uniqueness
    const [existing] = await db.select().from(riders).where(eq(riders.phone, phone)).limit(1);
    if (existing) {
      res.status(400).json({ success: false, message: `A rider with mobile number ${phone} already exists.` });
      return;
    }

    const [newRider] = await db
      .insert(riders)
      .values({
        name,
        phone,
        vehicleType: vehicleType || 'Two Wheeler',
        vehicleNumber: vehicleNumber || null,
        idProofUrl: idProofUrl || null,
        status,
        cashBalance: '0.00',
        isOnline: false,
      })
      .returning();

    await auditService.log(
      { actorType: 'admin', actorId: req.admin!.userId, ipAddress: clientIp },
      'rider_created',
      { type: 'rider', id: newRider.id },
      { name, phone, status }
    );

    res.status(201).json({ success: true, rider: newRider, message: 'Rider added successfully.' });
  } catch (err: any) {
    console.error('Error creating rider:', err);
    res.status(500).json({ success: false, message: 'Failed to add rider.' });
  }
});

/**
 * POST /api/v1/admin/riders/:id/approve
 * Approves a pending rider.
 */
router.post('/riders/:id/approve', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = getParam(req.params.id);
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

    const [rider] = await db.select().from(riders).where(eq(riders.id, id)).limit(1);
    if (!rider) {
      res.status(404).json({ success: false, message: 'Rider not found.' });
      return;
    }

    await db
      .update(riders)
      .set({ status: 'approved', blockReason: null, updatedAt: new Date() })
      .where(eq(riders.id, id));

    await auditService.log(
      { actorType: 'admin', actorId: req.admin!.userId, ipAddress: clientIp },
      'rider_approved',
      { type: 'rider', id },
      { riderName: rider.name, phone: rider.phone }
    );

    res.status(200).json({ success: true, message: `Rider ${rider.name} has been approved.` });
  } catch (err: any) {
    console.error('Error approving rider:', err);
    res.status(500).json({ success: false, message: 'Failed to approve rider.' });
  }
});

/**
 * POST /api/v1/admin/riders/:id/block
 * Blocks a rider with a required reason.
 */
router.post('/riders/:id/block', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = getParam(req.params.id);
    const { reason } = req.body;
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

    if (!reason || !reason.trim()) {
      res.status(400).json({ success: false, message: 'A reason for blocking the rider is required.' });
      return;
    }

    const [rider] = await db.select().from(riders).where(eq(riders.id, id)).limit(1);
    if (!rider) {
      res.status(404).json({ success: false, message: 'Rider not found.' });
      return;
    }

    await db
      .update(riders)
      .set({
        status: 'blocked',
        blockReason: reason.trim(),
        isOnline: false,
        updatedAt: new Date(),
      })
      .where(eq(riders.id, id));

    await auditService.log(
      { actorType: 'admin', actorId: req.admin!.userId, ipAddress: clientIp },
      'rider_blocked',
      { type: 'rider', id },
      { riderName: rider.name, reason: reason.trim() }
    );

    res.status(200).json({ success: true, message: `Rider ${rider.name} has been blocked.` });
  } catch (err: any) {
    console.error('Error blocking rider:', err);
    res.status(500).json({ success: false, message: 'Failed to block rider.' });
  }
});

/**
 * POST /api/v1/admin/riders/:id/unblock
 * Unblocks a rider.
 */
router.post('/riders/:id/unblock', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = getParam(req.params.id);
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

    const [rider] = await db.select().from(riders).where(eq(riders.id, id)).limit(1);
    if (!rider) {
      res.status(404).json({ success: false, message: 'Rider not found.' });
      return;
    }

    await db
      .update(riders)
      .set({ status: 'approved', blockReason: null, updatedAt: new Date() })
      .where(eq(riders.id, id));

    await auditService.log(
      { actorType: 'admin', actorId: req.admin!.userId, ipAddress: clientIp },
      'rider_unblocked',
      { type: 'rider', id },
      { riderName: rider.name }
    );

    res.status(200).json({ success: true, message: `Rider ${rider.name} has been unblocked.` });
  } catch (err: any) {
    console.error('Error unblocking rider:', err);
    res.status(500).json({ success: false, message: 'Failed to unblock rider.' });
  }
});

/* ==========================================================================
   4. CASH MANAGEMENT & PER-RIDER BALANCES
   ========================================================================== */

/**
 * GET /api/v1/admin/cash/riders
 * Per-rider balances and settlement summary.
 */
router.get('/cash/riders', async (_req: Request, res: Response): Promise<void> => {
  try {
    const allRiders = await db
      .select({
        id: riders.id,
        name: riders.name,
        phone: riders.phone,
        status: riders.status,
        vehicleType: riders.vehicleType,
        cashBalance: riders.cashBalance,
        isOnline: riders.isOnline,
        updatedAt: riders.updatedAt,
      })
      .from(riders)
      .orderBy(desc(riders.cashBalance));

    // Get last entry time for each rider
    const lastEntries = await db
      .select({
        riderId: riderCashLedger.riderId,
        lastCreatedAt: sql<Date>`max(${riderCashLedger.createdAt})`,
      })
      .from(riderCashLedger)
      .groupBy(riderCashLedger.riderId);

    const lastEntryMap = new Map<string, Date>();
    for (const le of lastEntries) {
      if (le.riderId && le.lastCreatedAt) {
        lastEntryMap.set(le.riderId, new Date(le.lastCreatedAt));
      }
    }

    const ridersWithLedger = allRiders.map((r) => ({
      ...r,
      balance: parseFloat(r.cashBalance || '0.00'),
      lastActivity: lastEntryMap.get(r.id) || r.updatedAt,
    }));

    // Aggregate statistics
    const totalCashHeld = ridersWithLedger.reduce((sum, r) => sum + r.balance, 0);

    res.status(200).json({
      success: true,
      riders: ridersWithLedger,
      totalCashHeld: totalCashHeld.toFixed(2),
    });
  } catch (err: any) {
    console.error('Error fetching cash balances:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve cash balances.' });
  }
});

/**
 * POST /api/v1/admin/cash/entry
 * Add entry dialog for float_given, deposit_made, adjustment.
 */
router.post('/cash/entry', async (req: Request, res: Response): Promise<void> => {
  try {
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

    const schema = z.object({
      riderId: z.string().uuid(),
      type: z.enum(['float_given', 'deposit_made', 'adjustment']),
      amount: z.number().positive('Amount must be greater than zero'),
      notes: z.string().trim().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, message: parsed.error.issues[0]?.message });
      return;
    }

    const { riderId, type, amount, notes } = parsed.data;

    const [rider] = await db.select().from(riders).where(eq(riders.id, riderId)).limit(1);
    if (!rider) {
      res.status(404).json({ success: false, message: 'Rider not found.' });
      return;
    }

    const currentBalance = parseFloat(rider.cashBalance || '0.00');
    let delta = 0;

    // float_given: Hub gives cash float to rider for purchasing medicine -> rider holds MORE cash (+amount)
    // deposit_made: Rider hands over customer cash to Hub -> rider holds LESS cash (-amount)
    // adjustment: Can be positive or negative depending on context (defaults to adjustment balance change)
    if (type === 'float_given') {
      delta = amount;
    } else if (type === 'deposit_made') {
      delta = -amount;
    } else if (type === 'adjustment') {
      delta = amount; // or adjustment offset
    }

    const newBalance = currentBalance + delta;

    await db.transaction(async (tx) => {
      // Update rider cash balance
      await tx
        .update(riders)
        .set({
          cashBalance: newBalance.toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(riders.id, riderId));

      // Insert ledger row
      await tx.insert(riderCashLedger).values({
        riderId,
        type,
        amount: amount.toFixed(2),
        balanceAfter: newBalance.toFixed(2),
        notes: notes || `Manual cash ${type.replace('_', ' ')} recorded by Hub admin`,
        recordedByAdminId: req.admin!.userId,
      });
    });

    await auditService.log(
      { actorType: 'admin', actorId: req.admin!.userId, ipAddress: clientIp },
      `cash_${type}`,
      { type: 'rider', id: riderId },
      {
        riderName: rider.name,
        amount,
        type,
        balanceBefore: currentBalance,
        balanceAfter: newBalance,
        notes,
      }
    );

    res.status(200).json({
      success: true,
      newBalance: newBalance.toFixed(2),
      message: `Cash entry recorded. New rider balance: ₹${newBalance.toFixed(2)}`,
    });
  } catch (err: any) {
    console.error('Error adding cash entry:', err);
    res.status(500).json({ success: false, message: 'Failed to record cash entry.' });
  }
});

/**
 * GET /api/v1/admin/cash/ledger/:riderId
 * History drawer per rider.
 */
router.get('/cash/ledger/:riderId', async (req: Request, res: Response): Promise<void> => {
  try {
    const riderId = getParam(req.params.riderId);

    const [rider] = await db.select().from(riders).where(eq(riders.id, riderId)).limit(1);
    if (!rider) {
      res.status(404).json({ success: false, message: 'Rider not found.' });
      return;
    }

    // Ledger transactions
    const transactions = await db
      .select({
        id: riderCashLedger.id,
        riderId: riderCashLedger.riderId,
        orderId: riderCashLedger.orderId,
        type: riderCashLedger.type,
        amount: riderCashLedger.amount,
        balanceAfter: riderCashLedger.balanceAfter,
        notes: riderCashLedger.notes,
        recordedByAdminId: riderCashLedger.recordedByAdminId,
        createdAt: riderCashLedger.createdAt,
      })
      .from(riderCashLedger)
      .where(eq(riderCashLedger.riderId, riderId))
      .orderBy(desc(riderCashLedger.createdAt))
      .limit(100);

    // Get order numbers for orderId references
    const orderIds = transactions.map((t) => t.orderId).filter(Boolean) as string[];
    const orderMap = new Map<string, string>();
    if (orderIds.length > 0) {
      const orderRows = await db
        .select({ id: orders.id, orderNumber: orders.orderNumber })
        .from(orders)
        .where(inArray(orders.id, orderIds));
      for (const o of orderRows) {
        orderMap.set(o.id, o.orderNumber);
      }
    }

    // Get admin names for recordedByAdminId
    const adminIds = transactions.map((t) => t.recordedByAdminId).filter(Boolean) as string[];
    const adminMap = new Map<string, string>();
    if (adminIds.length > 0) {
      const adminRows = await db
        .select({ id: admins.id, name: admins.name })
        .from(admins)
        .where(inArray(admins.id, adminIds));
      for (const a of adminRows) {
        adminMap.set(a.id, a.name);
      }
    }

    const enriched = transactions.map((t) => ({
      ...t,
      orderNumber: t.orderId ? orderMap.get(t.orderId) || null : null,
      recordedByAdminName: t.recordedByAdminId ? adminMap.get(t.recordedByAdminId) || null : null,
    }));

    res.status(200).json({
      success: true,
      rider: {
        id: rider.id,
        name: rider.name,
        phone: rider.phone,
        cashBalance: rider.cashBalance,
      },
      transactions: enriched,
    });
  } catch (err: any) {
    console.error('Error fetching cash ledger history:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve ledger history.' });
  }
});

/* ==========================================================================
   5. CUSTOMERS MANAGEMENT
   ========================================================================== */

/**
 * GET /api/v1/admin/customers
 * Customers directory with search, order history, block and unblock.
 */
router.get('/customers', async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string || '25', 10)));
    const offset = (page - 1) * limit;
    const search = (req.query.search as string || '').trim();

    const conditions: any[] = [];
    if (search) {
      const cleanPhone = search.replace(/\D/g, '');
      const searchOr = [ilike(customers.name, `%${search}%`)];
      if (cleanPhone.length >= 3) {
        searchOr.push(ilike(customers.phone, `%${cleanPhone}%`));
      }
      conditions.push(or(...searchOr));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(customers)
      .where(whereClause);
    const total = Number(countResult?.count || 0);

    const customerRows = await db
      .select()
      .from(customers)
      .where(whereClause)
      .orderBy(desc(customers.createdAt))
      .limit(limit)
      .offset(offset);

    // Get order stats for each customer (total orders, total spend)
    const customerIds = customerRows.map((c) => c.id);
    const statsMap = new Map<string, { orderCount: number; totalSpend: number }>();

    if (customerIds.length > 0) {
      const orderStats = await db
        .select({
          customerId: orders.customerId,
          orderCount: sql<number>`count(*)`,
          totalSpend: sql<number>`coalesce(sum(case when ${orders.status} = 'delivered' then coalesce(${orders.finalAmount}, ${orders.totalAmount}, 0) else 0 end), 0)`,
        })
        .from(orders)
        .where(inArray(orders.customerId, customerIds))
        .groupBy(orders.customerId);

      for (const stat of orderStats) {
        if (stat.customerId) {
          statsMap.set(stat.customerId, {
            orderCount: Number(stat.orderCount),
            totalSpend: Number(stat.totalSpend),
          });
        }
      }
    }

    const enriched = customerRows.map((c) => {
      const s = statsMap.get(c.id) || { orderCount: 0, totalSpend: 0 };
      return {
        ...c,
        orderCount: s.orderCount,
        totalSpend: s.totalSpend.toFixed(2),
      };
    });

    res.status(200).json({
      success: true,
      customers: enriched,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (err: any) {
    console.error('Error fetching customers:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve customers.' });
  }
});

/**
 * GET /api/v1/admin/customers/:id
 * Customer detail with order history.
 */
router.get('/customers/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = getParam(req.params.id);

    const [customer] = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
    if (!customer) {
      res.status(404).json({ success: false, message: 'Customer not found.' });
      return;
    }

    const customerAddresses = await db
      .select()
      .from(addresses)
      .where(eq(addresses.customerId, id))
      .orderBy(desc(addresses.createdAt));

    const customerOrders = await db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        status: orders.status,
        totalAmount: orders.totalAmount,
        finalAmount: orders.finalAmount,
        source: orders.source,
        paymentMethod: orders.paymentMethod,
        paymentStatus: orders.paymentStatus,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .where(eq(orders.customerId, id))
      .orderBy(desc(orders.createdAt));

    res.status(200).json({
      success: true,
      customer,
      addresses: customerAddresses,
      orders: customerOrders,
    });
  } catch (err: any) {
    console.error('Error fetching customer detail:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve customer details.' });
  }
});

/**
 * POST /api/v1/admin/customers/:id/block
 * Block a customer with a required reason.
 */
router.post('/customers/:id/block', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = getParam(req.params.id);
    const { reason } = req.body;
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

    if (!reason || !reason.trim()) {
      res.status(400).json({ success: false, message: 'A reason for blocking the customer is required.' });
      return;
    }

    const [customer] = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
    if (!customer) {
      res.status(404).json({ success: false, message: 'Customer not found.' });
      return;
    }

    await db
      .update(customers)
      .set({
        isActive: false,
        blockReason: reason.trim(),
        updatedAt: new Date(),
      })
      .where(eq(customers.id, id));

    await auditService.log(
      { actorType: 'admin', actorId: req.admin!.userId, ipAddress: clientIp },
      'customer_blocked',
      { type: 'customer', id },
      { customerName: customer.name, phone: customer.phone, reason: reason.trim() }
    );

    res.status(200).json({ success: true, message: `Customer ${customer.name} has been blocked.` });
  } catch (err: any) {
    console.error('Error blocking customer:', err);
    res.status(500).json({ success: false, message: 'Failed to block customer.' });
  }
});

/**
 * POST /api/v1/admin/customers/:id/unblock
 * Unblock a customer.
 */
router.post('/customers/:id/unblock', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = getParam(req.params.id);
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

    const [customer] = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
    if (!customer) {
      res.status(404).json({ success: false, message: 'Customer not found.' });
      return;
    }

    await db
      .update(customers)
      .set({
        isActive: true,
        blockReason: null,
        updatedAt: new Date(),
      })
      .where(eq(customers.id, id));

    await auditService.log(
      { actorType: 'admin', actorId: req.admin!.userId, ipAddress: clientIp },
      'customer_unblocked',
      { type: 'customer', id },
      { customerName: customer.name, phone: customer.phone }
    );

    res.status(200).json({ success: true, message: `Customer ${customer.name} has been unblocked.` });
  } catch (err: any) {
    console.error('Error unblocking customer:', err);
    res.status(500).json({ success: false, message: 'Failed to unblock customer.' });
  }
});

/* ==========================================================================
   6. REPORTS & METRICS & CSV EXPORT
   ========================================================================== */

/**
 * GET /api/v1/admin/reports
 * KPI metrics & 3 charts dataset (Orders volume, sources breakdown, hourly delivery performance).
 */
router.get('/reports', async (req: Request, res: Response): Promise<void> => {
  try {
    const startDateParam = req.query.startDate as string;
    const endDateParam = req.query.endDate as string;

    const conditions: any[] = [];
    if (startDateParam) {
      const s = new Date(startDateParam);
      if (!isNaN(s.getTime())) conditions.push(gte(orders.createdAt, s));
    }
    if (endDateParam) {
      const e = new Date(endDateParam);
      if (!isNaN(e.getTime())) {
        e.setHours(23, 59, 59, 999);
        conditions.push(lte(orders.createdAt, e));
      }
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Fetch orders in range
    const orderRows = await db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        status: orders.status,
        source: orders.source,
        totalAmount: orders.totalAmount,
        finalAmount: orders.finalAmount,
        createdAt: orders.createdAt,
        updatedAt: orders.updatedAt,
        assignedAt: orders.assignedAt,
      })
      .from(orders)
      .where(whereClause)
      .orderBy(orders.createdAt);

    const totalOrders = orderRows.length;
    const deliveredOrders = orderRows.filter((o) => o.status === 'delivered').length;
    const cancelledOrders = orderRows.filter((o) => o.status === 'cancelled').length;
    const cancellationRate = totalOrders > 0 ? ((cancelledOrders / totalOrders) * 100).toFixed(1) : '0.0';

    // Calculate average minutes from placed to delivered
    const deliveredWithTime = orderRows.filter((o) => o.status === 'delivered');
    let totalDeliveryMinutes = 0;
    for (const d of deliveredWithTime) {
      const placed = new Date(d.createdAt).getTime();
      const finished = new Date(d.updatedAt).getTime();
      const diffMins = Math.max(1, Math.round((finished - placed) / 60000));
      totalDeliveryMinutes += diffMins;
    }
    const avgDeliveryMinutes = deliveredWithTime.length > 0 ? Math.round(totalDeliveryMinutes / deliveredWithTime.length) : 0;

    // Chart 1: Daily Orders Trend (Delivered vs Cancelled vs Total)
    const dailyMap = new Map<string, { date: string; total: number; delivered: number; cancelled: number }>();
    for (const o of orderRows) {
      const dt = new Date(o.createdAt).toISOString().split('T')[0];
      if (!dailyMap.has(dt)) {
        dailyMap.set(dt, { date: dt, total: 0, delivered: 0, cancelled: 0 });
      }
      const entry = dailyMap.get(dt)!;
      entry.total += 1;
      if (o.status === 'delivered') entry.delivered += 1;
      if (o.status === 'cancelled') entry.cancelled += 1;
    }
    const dailyTrend = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    // Chart 2: Source Breakdown (web vs phone vs whatsapp)
    const sourceCounts: Record<string, number> = { web: 0, phone: 0, whatsapp: 0 };
    for (const o of orderRows) {
      if (o.source in sourceCounts) {
        sourceCounts[o.source] += 1;
      }
    }
    const sourceBreakdown = [
      { name: 'Web Store', key: 'web', count: sourceCounts.web },
      { name: 'Phone Call', key: 'phone', count: sourceCounts.phone },
      { name: 'WhatsApp', key: 'whatsapp', count: sourceCounts.whatsapp },
    ];

    // Chart 3: Hourly performance / distribution (0 to 23 hours)
    const hourlyDistribution = Array.from({ length: 24 }, (_, i) => ({
      hour: `${i}:00`,
      orders: 0,
    }));
    for (const o of orderRows) {
      const hr = new Date(o.createdAt).getHours();
      if (hourlyDistribution[hr]) {
        hourlyDistribution[hr].orders += 1;
      }
    }

    res.status(200).json({
      success: true,
      kpis: {
        totalOrders,
        deliveredOrders,
        cancellationRate: `${cancellationRate}%`,
        avgDeliveryMinutes: `${avgDeliveryMinutes} mins`,
      },
      charts: {
        dailyTrend,
        sourceBreakdown,
        hourlyDistribution,
      },
    });
  } catch (err: any) {
    console.error('Error generating reports:', err);
    res.status(500).json({ success: false, message: 'Failed to generate reports.' });
  }
});

/**
 * GET /api/v1/admin/reports/csv
 * Stream CSV export of orders.
 */
router.get('/reports/csv', async (req: Request, res: Response): Promise<void> => {
  try {
    const startDateParam = req.query.startDate as string;
    const endDateParam = req.query.endDate as string;

    const conditions: any[] = [];
    if (startDateParam) {
      const s = new Date(startDateParam);
      if (!isNaN(s.getTime())) conditions.push(gte(orders.createdAt, s));
    }
    if (endDateParam) {
      const e = new Date(endDateParam);
      if (!isNaN(e.getTime())) {
        e.setHours(23, 59, 59, 999);
        conditions.push(lte(orders.createdAt, e));
      }
    }

    const orderRows = await db
      .select()
      .from(orders)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(orders.createdAt));

    // Get rider names
    const riderIds = Array.from(new Set(orderRows.map((o) => o.riderId).filter(Boolean))) as string[];
    const riderMap = new Map<string, string>();
    if (riderIds.length > 0) {
      const rRows = await db.select({ id: riders.id, name: riders.name }).from(riders).where(inArray(riders.id, riderIds));
      for (const r of rRows) riderMap.set(r.id, r.name);
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="zupit_orders_report.csv"');

    const headers = [
      'Order Number',
      'Placed At',
      'Customer Name',
      'Phone',
      'Delivery Address',
      'Pincode',
      'Source',
      'Assigned Rider',
      'Order Status',
      'Payment Method',
      'Payment Status',
      'Subtotal (INR)',
      'Delivery Fee (INR)',
      'Total Amount (INR)',
      'Cancel Reason',
    ];

    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    let csvContent = headers.join(',') + '\n';
    for (const o of orderRows) {
      const row = [
        escapeCsv(o.orderNumber),
        escapeCsv(new Date(o.createdAt).toLocaleString()),
        escapeCsv(o.deliveryName),
        escapeCsv(o.deliveryPhone),
        escapeCsv(o.deliveryAddress),
        escapeCsv(o.deliveryPincode),
        escapeCsv(o.source),
        escapeCsv(o.riderId ? riderMap.get(o.riderId) || 'Unassigned' : 'Unassigned'),
        escapeCsv(o.status),
        escapeCsv(o.paymentMethod),
        escapeCsv(o.paymentStatus),
        escapeCsv(o.subtotalAmount),
        escapeCsv(o.deliveryFee),
        escapeCsv(o.finalAmount || o.totalAmount),
        escapeCsv(o.cancelReason || ''),
      ];
      csvContent += row.join(',') + '\n';
    }

    res.status(200).send(csvContent);
  } catch (err: any) {
    console.error('Error generating CSV:', err);
    res.status(500).json({ success: false, message: 'Failed to generate CSV export.' });
  }
});

/* ==========================================================================
   7. MESSAGE TEMPLATES & ADMINS
   ========================================================================== */

/**
 * GET /api/v1/admin/templates
 * Message templates tabs for English and Hindi.
 */
router.get('/templates', async (_req: Request, res: Response): Promise<void> => {
  try {
    const allTemplates = await db.select().from(messageTemplates).orderBy(messageTemplates.key);
    res.status(200).json({
      success: true,
      templates: allTemplates,
    });
  } catch (err: any) {
    console.error('Error fetching templates:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve message templates.' });
  }
});

/**
 * PUT /api/v1/admin/templates/:id
 * Update message template body (Owner only).
 */
router.put(
  '/templates/:id',
  requireRole(['owner']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = getParam(req.params.id);
      const { templateBody, title, isActive } = req.body;
      const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

      if (!templateBody || !templateBody.trim()) {
        res.status(400).json({ success: false, message: 'Template body cannot be empty.' });
        return;
      }

      const [existing] = await db.select().from(messageTemplates).where(eq(messageTemplates.id, id)).limit(1);
      if (!existing) {
        res.status(404).json({ success: false, message: 'Template not found.' });
        return;
      }

      const [updated] = await db
        .update(messageTemplates)
        .set({
          templateBody: templateBody.trim(),
          title: title ? title.trim() : existing.title,
          isActive: typeof isActive === 'boolean' ? isActive : existing.isActive,
          updatedAt: new Date(),
        })
        .where(eq(messageTemplates.id, id))
        .returning();

      await auditService.log(
        { actorType: 'admin', actorId: req.admin!.userId, ipAddress: clientIp },
        'template_updated',
        { type: 'message_template', id },
        { key: existing.key, language: existing.language }
      );

      res.status(200).json({
        success: true,
        template: updated,
        message: 'Message template updated successfully.',
      });
    } catch (err: any) {
      console.error('Error updating template:', err);
      res.status(500).json({ success: false, message: 'Failed to update message template.' });
    }
  }
);

/**
 * GET /api/v1/admin/admins
 * List of administrators.
 */
router.get('/admins', async (_req: Request, res: Response): Promise<void> => {
  try {
    const adminList = await db
      .select({
        id: admins.id,
        name: admins.name,
        email: admins.email,
        phone: admins.phone,
        role: admins.role,
        isActive: admins.isActive,
        createdAt: admins.createdAt,
      })
      .from(admins)
      .orderBy(admins.createdAt);

    res.status(200).json({
      success: true,
      admins: adminList,
    });
  } catch (err: any) {
    console.error('Error fetching admins:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve administrators.' });
  }
});

export default router;
