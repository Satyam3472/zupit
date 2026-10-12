import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  numeric,
  timestamp,
  jsonb,
  pgEnum,
  pgSequence,
  check,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/* ==========================================================================
   Postgres Enums
   ========================================================================== */

export const orderStatusEnum = pgEnum('order_status', [
  'placed',
  'rider_assigned',
  'buying',
  'out_for_delivery',
  'delivered',
  'cancelled',
  'delivery_failed',
]);

export const orderSourceEnum = pgEnum('order_source', [
  'web',
  'phone',
  'whatsapp',
]);

export const paymentMethodEnum = pgEnum('payment_method', [
  'cod',
  'online',
]);

export const paymentStatusEnum = pgEnum('payment_status', [
  'pending',
  'paid',
  'failed',
  'refunded',
]);

export const itemStatusEnum = pgEnum('item_status', [
  'pending',
  'bought',
  'unavailable',
  'skipped',
]);

export const riderStatusEnum = pgEnum('rider_status', [
  'pending_approval',
  'approved',
  'blocked',
]);

export const adminRoleEnum = pgEnum('admin_role', [
  'owner',
  'ops',
]);

export const actorTypeEnum = pgEnum('actor_type', [
  'customer',
  'rider',
  'admin',
  'system',
]);

export const ledgerTypeEnum = pgEnum('ledger_type', [
  'float_given',
  'purchase_spent',
  'cash_collected',
  'deposit_made',
  'adjustment',
]);

/* ==========================================================================
   Sequences
   ========================================================================== */

export const orderNumberSeq = pgSequence('order_number_seq', {
  startWith: 10001,
});

/* ==========================================================================
   1. Customers Table
   ========================================================================== */

export const customers = pgTable('customers', {
  id: uuid('id').defaultRandom().primaryKey(),
  phone: text('phone').notNull().unique(),
  name: text('name').notNull(),
  email: text('email'),
  isActive: boolean('is_active').default(true).notNull(),
  blockReason: text('block_reason'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
});

/* ==========================================================================
   2. Addresses Table
   ========================================================================== */

export const addresses = pgTable('addresses', {
  id: uuid('id').defaultRandom().primaryKey(),
  customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'restrict' }),
  recipientName: text('recipient_name'),
  recipientPhone: text('recipient_phone'),
  houseFlat: text('house_flat').notNull(),
  streetArea: text('street_area').notNull(),
  landmark: text('landmark'),
  pincode: text('pincode').notNull(),
  city: text('city').default('Jamui').notNull(),
  state: text('state').default('Bihar').notNull(),
  latitude: numeric('latitude', { precision: 10, scale: 7 }),
  longitude: numeric('longitude', { precision: 10, scale: 7 }),
  isDefault: boolean('is_default').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
});

/* ==========================================================================
   3. Riders Table
   ========================================================================== */

export const riders = pgTable('riders', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  phone: text('phone').notNull().unique(),
  status: riderStatusEnum('status').default('pending_approval').notNull(),
  vehicleType: text('vehicle_type'),
  vehicleNumber: text('vehicle_number'),
  idProofUrl: text('id_proof_url'),
  blockReason: text('block_reason'),
  cashBalance: numeric('cash_balance', { precision: 10, scale: 2 }).default('0.00').notNull(),
  isOnline: boolean('is_online').default(false).notNull(),
  currentLatitude: numeric('current_latitude', { precision: 10, scale: 7 }),
  currentLongitude: numeric('current_longitude', { precision: 10, scale: 7 }),
  lastActiveAt: timestamp('last_active_at', { withTimezone: true, mode: 'date' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
});

/* ==========================================================================
   4. Admins Table
   ========================================================================== */

export const admins = pgTable('admins', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  phone: text('phone'),
  passwordHash: text('password_hash'),
  role: adminRoleEnum('role').default('ops').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
});

/* ==========================================================================
   5. Orders Table
   ========================================================================== */

export const orders = pgTable('orders', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderNumber: text('order_number')
    .default(sql`'ZP-' || nextval('order_number_seq')`)
    .notNull()
    .unique(),
  customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'restrict' }),
  addressId: uuid('address_id').references(() => addresses.id, { onDelete: 'restrict' }),
  deliveryName: text('delivery_name').notNull(),
  deliveryPhone: text('delivery_phone').notNull(),
  deliveryAddress: text('delivery_address').notNull(),
  deliveryLandmark: text('delivery_landmark'),
  deliveryPincode: text('delivery_pincode').notNull(),
  deliveryCode: text('delivery_code'),
  deliveryCodeAttempts: integer('delivery_code_attempts').default(0).notNull(),
  riderId: uuid('rider_id').references(() => riders.id, { onDelete: 'restrict' }),
  status: orderStatusEnum('status').default('placed').notNull(),
  source: orderSourceEnum('source').default('web').notNull(),
  paymentMethod: paymentMethodEnum('payment_method').default('cod').notNull(),
  paymentStatus: paymentStatusEnum('payment_status').default('pending').notNull(),
  subtotalAmount: numeric('subtotal_amount', { precision: 10, scale: 2 }).default('0.00').notNull(),
  billTotal: numeric('bill_total', { precision: 10, scale: 2 }),
  finalAmount: numeric('final_amount', { precision: 10, scale: 2 }),
  deliveryFee: numeric('delivery_fee', { precision: 10, scale: 2 }).default('0.00').notNull(),
  totalAmount: numeric('total_amount', { precision: 10, scale: 2 }).default('0.00').notNull(),
  notes: text('notes'),
  trackingToken: text('tracking_token').notNull().unique(),
  cancelReason: text('cancel_reason'),
  createdByAdminId: uuid('created_by_admin_id').references(() => admins.id, { onDelete: 'restrict' }),
  assignedAt: timestamp('assigned_at', { withTimezone: true, mode: 'date' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => [
  index('orders_status_created_at_idx').on(table.status, table.createdAt.desc()),
  index('orders_rider_id_status_idx').on(table.riderId, table.status),
  index('orders_customer_id_created_at_idx').on(table.customerId, table.createdAt.desc()),
  index('orders_delivery_phone_order_number_idx').on(table.deliveryPhone, table.orderNumber),
]);

/* ==========================================================================
   6. Order Items Table
   ========================================================================== */

export const orderItems = pgTable('order_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderId: uuid('order_id')
    .notNull()
    .references(() => orders.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  strength: text('strength'),
  quantity: integer('quantity').notNull(),
  unitPrice: numeric('unit_price', { precision: 10, scale: 2 }),
  totalPrice: numeric('total_price', { precision: 10, scale: 2 }),
  status: itemStatusEnum('status').default('pending').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => [
  index('order_items_order_id_idx').on(table.orderId),
  check('order_items_quantity_check', sql`${table.quantity} > 0`),
]);

/* ==========================================================================
   7. Prescriptions Table
   ========================================================================== */

export const prescriptions = pgTable('prescriptions', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderId: uuid('order_id')
    .notNull()
    .references(() => orders.id, { onDelete: 'cascade' }),
  fileUrl: text('file_url').notNull(),
  fileType: text('file_type'),
  fileSize: integer('file_size'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => [
  index('prescriptions_order_id_idx').on(table.orderId),
]);

/* ==========================================================================
   8. Bills Table
   ========================================================================== */

export const bills = pgTable('bills', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderId: uuid('order_id')
    .notNull()
    .references(() => orders.id, { onDelete: 'cascade' }),
  riderId: uuid('rider_id').references(() => riders.id, { onDelete: 'restrict' }),
  pharmacyName: text('pharmacy_name'),
  billNumber: text('bill_number'),
  billImageUrl: text('bill_image_url').notNull(),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  verifiedByAdminId: uuid('verified_by_admin_id').references(() => admins.id, { onDelete: 'restrict' }),
  verifiedAt: timestamp('verified_at', { withTimezone: true, mode: 'date' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => [
  index('bills_order_id_idx').on(table.orderId),
  check('bills_amount_check', sql`${table.amount} >= 0`),
]);

/* ==========================================================================
   9. Payments Table
   ========================================================================== */

export const payments = pgTable('payments', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderId: uuid('order_id')
    .notNull()
    .references(() => orders.id, { onDelete: 'cascade' }),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  paymentMethod: paymentMethodEnum('payment_method').notNull(),
  status: paymentStatusEnum('status').default('pending').notNull(),
  transactionId: text('transaction_id'),
  gateway: text('gateway'),
  idempotencyKey: text('idempotency_key').unique(),
  gatewayResponse: jsonb('gateway_response'),
  paidAt: timestamp('paid_at', { withTimezone: true, mode: 'date' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => [
  index('payments_order_id_idx').on(table.orderId),
]);

/* ==========================================================================
   10. Order Status Events Table
   ========================================================================== */

export const orderStatusEvents = pgTable('order_status_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderId: uuid('order_id')
    .notNull()
    .references(() => orders.id, { onDelete: 'cascade' }),
  status: orderStatusEnum('status').notNull(),
  actorType: actorTypeEnum('actor_type').notNull(),
  actorId: uuid('actor_id'),
  notes: text('notes'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => [
  index('order_status_events_order_id_idx').on(table.orderId),
]);

/* ==========================================================================
   11. Rider Cash Ledger Table
   ========================================================================== */

export const riderCashLedger = pgTable('rider_cash_ledger', {
  id: uuid('id').defaultRandom().primaryKey(),
  riderId: uuid('rider_id')
    .notNull()
    .references(() => riders.id, { onDelete: 'restrict' }),
  orderId: uuid('order_id').references(() => orders.id, { onDelete: 'restrict' }),
  type: ledgerTypeEnum('type').notNull(),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  balanceAfter: numeric('balance_after', { precision: 10, scale: 2 }).notNull(),
  notes: text('notes'),
  recordedByAdminId: uuid('recorded_by_admin_id').references(() => admins.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => [
  index('rider_cash_ledger_rider_id_created_at_idx').on(table.riderId, table.createdAt.desc()),
  index('rider_cash_ledger_order_id_idx').on(table.orderId),
]);

/* ==========================================================================
   12. Settings Table
   ========================================================================== */

export const settings = pgTable('settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  key: text('key').notNull().unique(),
  value: text('value').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
});

/* ==========================================================================
   13. Serviceable Areas Table
   ========================================================================== */

export const serviceableAreas = pgTable('serviceable_areas', {
  id: uuid('id').defaultRandom().primaryKey(),
  pincode: text('pincode').notNull().unique(),
  areaName: text('area_name').notNull(),
  city: text('city').default('Jamui').notNull(),
  state: text('state').default('Bihar').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  deliveryRadiusKm: numeric('delivery_radius_km', { precision: 5, scale: 2 }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
});

/* ==========================================================================
   14. OTP Codes Table
   ========================================================================== */

export const otpCodes = pgTable('otp_codes', {
  id: uuid('id').defaultRandom().primaryKey(),
  phone: text('phone').notNull(),
  code: text('code').notNull(),
  purpose: text('purpose').default('verification').notNull(),
  attempts: integer('attempts').default(0).notNull(),
  isVerified: boolean('is_verified').default(false).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
});

/* ==========================================================================
   15. Order Ratings Table
   ========================================================================== */

export const orderRatings = pgTable('order_ratings', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderId: uuid('order_id')
    .notNull()
    .unique()
    .references(() => orders.id, { onDelete: 'cascade' }),
  customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'restrict' }),
  rating: integer('rating').notNull(),
  comment: text('comment'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => [
  index('order_ratings_order_id_idx').on(table.orderId),
]);

/* ==========================================================================
   16. Message Templates Table
   ========================================================================== */

export const messageTemplates = pgTable('message_templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  key: text('key').notNull(),
  language: text('language').notNull(), // 'en' | 'hi'
  channel: text('channel').default('sms').notNull(), // 'sms' | 'whatsapp'
  title: text('title'),
  templateBody: text('template_body').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
});

/* ==========================================================================
   17. Notifications Table
   ========================================================================== */

export const notifications = pgTable('notifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderId: uuid('order_id').references(() => orders.id, { onDelete: 'cascade' }),
  recipientPhone: text('recipient_phone').notNull(),
  recipientType: actorTypeEnum('recipient_type').default('customer').notNull(),
  channel: text('channel').default('sms').notNull(), // 'sms' | 'whatsapp'
  messageBody: text('message_body').notNull(),
  status: text('status').default('pending').notNull(), // 'pending' | 'sent' | 'failed'
  sentAt: timestamp('sent_at', { withTimezone: true, mode: 'date' }),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => [
  index('notifications_order_id_idx').on(table.orderId),
]);

/* ==========================================================================
   18. Audit Logs Table
   ========================================================================== */

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  actorType: actorTypeEnum('actor_type').notNull(),
  actorId: uuid('actor_id'),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id'),
  details: jsonb('details'),
  ipAddress: text('ip_address'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
});

/* ==========================================================================
   Inferred TypeScript Types
   ========================================================================== */

export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;

export type Address = typeof addresses.$inferSelect;
export type NewAddress = typeof addresses.$inferInsert;

export type Rider = typeof riders.$inferSelect;
export type NewRider = typeof riders.$inferInsert;

export type Admin = typeof admins.$inferSelect;
export type NewAdmin = typeof admins.$inferInsert;

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;

export type OrderItem = typeof orderItems.$inferSelect;
export type NewOrderItem = typeof orderItems.$inferInsert;

export type Prescription = typeof prescriptions.$inferSelect;
export type NewPrescription = typeof prescriptions.$inferInsert;

export type Bill = typeof bills.$inferSelect;
export type NewBill = typeof bills.$inferInsert;

export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;

export type OrderStatusEvent = typeof orderStatusEvents.$inferSelect;
export type NewOrderStatusEvent = typeof orderStatusEvents.$inferInsert;

export type RiderCashLedger = typeof riderCashLedger.$inferSelect;
export type NewRiderCashLedger = typeof riderCashLedger.$inferInsert;

export type Setting = typeof settings.$inferSelect;
export type NewSetting = typeof settings.$inferInsert;

export type ServiceableArea = typeof serviceableAreas.$inferSelect;
export type NewServiceableArea = typeof serviceableAreas.$inferInsert;

export type OtpCode = typeof otpCodes.$inferSelect;
export type NewOtpCode = typeof otpCodes.$inferInsert;

export type OrderRating = typeof orderRatings.$inferSelect;
export type NewOrderRating = typeof orderRatings.$inferInsert;

export type MessageTemplate = typeof messageTemplates.$inferSelect;
export type NewMessageTemplate = typeof messageTemplates.$inferInsert;

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
