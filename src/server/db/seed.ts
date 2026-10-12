import { db, pool } from './index.js';
import {
  settings,
  admins,
  riders,
  serviceableAreas,
  messageTemplates,
} from './schema.js';
import { eq, and, sql } from 'drizzle-orm';
import * as dotenv from 'dotenv';

dotenv.config();

export async function seed() {
  console.log('🌱 Starting idempotent database seeding for Zupit...');

  /* -------------------------------------------------------------------------
     1. Settings (Idempotent upsert by key)
     ------------------------------------------------------------------------- */
  const defaultSettings = [
    { key: 'delivery_fee', value: '0', description: 'Doorstep medicine delivery fee in INR' },
    { key: 'service_fee', value: '0', description: 'Platform service fee in INR' },
    { key: 'cod_enabled', value: 'true', description: 'Enable cash on delivery payment' },
    { key: 'cod_limit', value: '5000', description: 'Maximum order amount eligible for COD in INR' },
    { key: 'bill_confirm_threshold', value: '2000', description: 'Orders above this amount require customer phone confirmation before purchase' },
    { key: 'accept_timeout_minutes', value: '5', description: 'Minutes before an unaccepted order is escalated to operations' },
    { key: 'otp_max_attempts', value: '5', description: 'Maximum invalid OTP attempts before 1-hour cooldown' },
  ];

  for (const s of defaultSettings) {
    await db
      .insert(settings)
      .values({
        key: s.key,
        value: s.value,
        description: s.description,
      })
      .onConflictDoUpdate({
        target: settings.key,
        set: {
          value: s.value,
          description: s.description,
          updatedAt: new Date(),
        },
      });
  }
  console.log(`✅ Seeded ${defaultSettings.length} settings records.`);

  /* -------------------------------------------------------------------------
     2. One Owner Admin from ENV (Idempotent upsert by email)
     ------------------------------------------------------------------------- */
  const ownerEmail = process.env.ADMIN_EMAIL || 'admin@zupit.in';
  const ownerName = process.env.ADMIN_NAME || 'Jamui Hub Owner';
  const ownerPhone = process.env.ADMIN_PHONE || '6207856200';
  const ownerPassword = process.env.ADMIN_PASSWORD || 'Admin@123';
  const { default: argon2 } = await import('argon2');
  const passwordHash = await argon2.hash(ownerPassword);

  await db
    .insert(admins)
    .values({
      name: ownerName,
      email: ownerEmail,
      phone: ownerPhone,
      passwordHash,
      role: 'owner',
      isActive: true,
    })
    .onConflictDoUpdate({
      target: admins.email,
      set: {
        name: ownerName,
        phone: ownerPhone,
        passwordHash,
        role: 'owner',
        isActive: true,
        updatedAt: new Date(),
      },
    });
  console.log(`✅ Seeded owner admin (${ownerEmail}).`);

  /* -------------------------------------------------------------------------
     3. 3 Approved Riders (Idempotent upsert by phone)
     ------------------------------------------------------------------------- */
  const defaultRiders = [
    {
      name: 'Sunil Kumar',
      phone: '9835123401',
      status: 'approved' as const,
      vehicleType: 'Two Wheeler (Scooter)',
      vehicleNumber: 'BR-46-A-1284',
      cashBalance: '0.00',
    },
    {
      name: 'Amit Sharma',
      phone: '9835123402',
      status: 'approved' as const,
      vehicleType: 'Two Wheeler (Motorcycle)',
      vehicleNumber: 'BR-46-B-5412',
      cashBalance: '0.00',
    },
    {
      name: 'Rahul Singh',
      phone: '9835123403',
      status: 'approved' as const,
      vehicleType: 'Two Wheeler (Motorcycle)',
      vehicleNumber: 'BR-46-C-9821',
      cashBalance: '0.00',
    },
    {
      name: 'Vikas Kumar (Pending)',
      phone: '9835123499',
      status: 'pending_approval' as const,
      vehicleType: 'Two Wheeler (Scooter)',
      vehicleNumber: 'BR-46-D-3301',
      cashBalance: '0.00',
    },
  ];

  for (const r of defaultRiders) {
    await db
      .insert(riders)
      .values(r)
      .onConflictDoUpdate({
        target: riders.phone,
        set: {
          name: r.name,
          status: r.status,
          vehicleType: r.vehicleType,
          vehicleNumber: r.vehicleNumber,
          updatedAt: new Date(),
        },
      });
  }
  console.log(`✅ Seeded ${defaultRiders.length} approved riders.`);

  /* -------------------------------------------------------------------------
     4. Serviceable Areas (811307 Jamui + 2 placeholder rows)
     ------------------------------------------------------------------------- */
  const defaultAreas = [
    {
      pincode: '811307',
      areaName: 'Jamui Central & Town (Sadar, Station Road, Gandhi Chowk)',
      city: 'Jamui',
      state: 'Bihar',
      isActive: true,
      deliveryRadiusKm: '12.50',
    },
    {
      pincode: '811301',
      areaName: 'Jhajha & Gidhaur Corridor (Placeholder)',
      city: 'Jamui',
      state: 'Bihar',
      isActive: false,
      deliveryRadiusKm: '15.00',
    },
    {
      pincode: '811313',
      areaName: 'Sono & Chakai Rural Belt (Placeholder)',
      city: 'Jamui',
      state: 'Bihar',
      isActive: false,
      deliveryRadiusKm: '20.00',
    },
  ];

  for (const a of defaultAreas) {
    await db
      .insert(serviceableAreas)
      .values(a)
      .onConflictDoUpdate({
        target: serviceableAreas.pincode,
        set: {
          areaName: a.areaName,
          city: a.city,
          state: a.state,
          isActive: a.isActive,
          deliveryRadiusKm: a.deliveryRadiusKm,
          updatedAt: new Date(),
        },
      });
  }
  console.log(`✅ Seeded ${defaultAreas.length} serviceable areas (verified Jamui 811307).`);

  /* -------------------------------------------------------------------------
     5. Default Message Templates (EN and HI)
     ------------------------------------------------------------------------- */
  const defaultTemplates = [
    // 1. Order Placed
    {
      key: 'order_placed',
      language: 'en',
      channel: 'sms',
      title: 'Order Placed Confirmation',
      templateBody: 'Hi {customer_name}, your Zupit medicine order {order_number} has been placed. Free delivery to {address}. Track live: {tracking_url}',
      isActive: true,
    },
    {
      key: 'order_placed',
      language: 'hi',
      channel: 'sms',
      title: 'ऑर्डर दर्ज होने की पुष्टि',
      templateBody: 'नमस्ते {customer_name}, आपका Zupit दवा ऑर्डर {order_number} दर्ज हो गया है। {address} पर मुफ्त डिलीवरी होगी। ट्रैक करें: {tracking_url}',
      isActive: true,
    },
    // 2. Rider Assigned
    {
      key: 'rider_assigned',
      language: 'en',
      channel: 'sms',
      title: 'Rider Assigned Notification',
      templateBody: 'Zupit rider {rider_name} ({rider_phone}) is assigned for your order {order_number}. Medicines will be purchased from local pharmacy shortly.',
      isActive: true,
    },
    {
      key: 'rider_assigned',
      language: 'hi',
      channel: 'sms',
      title: 'राइडर असाइन सूचना',
      templateBody: 'आपके ऑर्डर {order_number} के लिए Zupit राइडर {rider_name} ({rider_phone}) को असाइन किया गया है। जल्द ही दवाइयां खरीदी जाएंगी।',
      isActive: true,
    },
    // 3. Bill Ready & Payment Link
    {
      key: 'bill_ready',
      language: 'en',
      channel: 'sms',
      title: 'Pharmacy Bill Ready',
      templateBody: 'Chemist bill for order {order_number} is ready: ₹{amount}. View physical bill & pay online: {tracking_url}',
      isActive: true,
    },
    {
      key: 'bill_ready',
      language: 'hi',
      channel: 'sms',
      title: 'दवा का पक्का बिल तैयार',
      templateBody: 'ऑर्डर {order_number} का पक्का बिल तैयार है: ₹{amount}। पर्ची देखकर ऑनलाइन भुगतान करें: {tracking_url}',
      isActive: true,
    },
    // 4. Out for Delivery & Handover Code
    {
      key: 'out_for_delivery',
      language: 'en',
      channel: 'sms',
      title: 'Out for Delivery Alert',
      templateBody: 'Rider {rider_name} is out for delivery with order {order_number}. Delivery verification code: {delivery_code}. Keep ₹{amount} cash ready if paying COD.',
      isActive: true,
    },
    {
      key: 'out_for_delivery',
      language: 'hi',
      channel: 'sms',
      title: 'डिलीवरी के लिए निकला',
      templateBody: 'राइडर {rider_name} ऑर्डर {order_number} लेकर निकल चुके हैं। डिलीवरी कोड: {delivery_code} बताएं। नकद भुगतान के लिए ₹{amount} तैयार रखें।',
      isActive: true,
    },
    // 5. Item Unavailable Alert
    {
      key: 'item_unavailable',
      language: 'en',
      channel: 'sms',
      title: 'Medicine Unavailable Alert',
      templateBody: '{item_name} was unavailable at pharmacy for order {order_number}. Please choose an action: {tracking_url} or rider will call you.',
      isActive: true,
    },
    {
      key: 'item_unavailable',
      language: 'hi',
      channel: 'sms',
      title: 'दवा उपलब्ध नहीं होने की सूचना',
      templateBody: 'ऑर्डर {order_number} की दवा {item_name} दुकान पर नहीं मिली। विकल्प चुनने के लिए लिंक खोलें: {tracking_url} या राइडर आपको कॉल करेंगे।',
      isActive: true,
    },
    // 6. Delivered
    {
      key: 'order_delivered',
      language: 'en',
      channel: 'sms',
      title: 'Delivery Confirmation & Rating',
      templateBody: 'Order {order_number} has been delivered! Total paid: ₹{amount}. Rate your Zupit experience: {tracking_url}',
      isActive: true,
    },
    {
      key: 'order_delivered',
      language: 'hi',
      channel: 'sms',
      title: 'डिलीवरी पूर्ण होने का संदेश',
      templateBody: 'ऑर्डर {order_number} डिलीवर हो चुका है! कुल भुगतान: ₹{amount}। कृपया अपना अनुभव साझा करें: {tracking_url}',
      isActive: true,
    },
  ];

  for (const t of defaultTemplates) {
    const existing = await db
      .select({ id: messageTemplates.id })
      .from(messageTemplates)
      .where(
        and(
          eq(messageTemplates.key, t.key),
          eq(messageTemplates.language, t.language),
          eq(messageTemplates.channel, t.channel)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(messageTemplates)
        .set({
          title: t.title,
          templateBody: t.templateBody,
          isActive: t.isActive,
          updatedAt: new Date(),
        })
        .where(eq(messageTemplates.id, existing[0].id));
    } else {
      await db.insert(messageTemplates).values(t);
    }
  }
  console.log(`✅ Seeded ${defaultTemplates.length} bilingual message templates.`);

  console.log('🎉 Database seeding completed successfully!');
}

// Auto-run if executed directly via CLI
if (process.argv[1]?.endsWith('seed.ts') || process.argv[1]?.endsWith('seed.js')) {
  seed()
    .then(async () => {
      await pool.end();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('❌ Seeding failed:', err);
      await pool.end();
      process.exit(1);
    });
}
