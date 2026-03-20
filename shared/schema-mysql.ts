import { sql } from "drizzle-orm";
import {
  mysqlTable,
  text,
  varchar,
  boolean,
  timestamp,
  int,
  decimal,
} from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = mysqlTable("users", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  email: text("email"), // Optional - can be null for phone-only auth
  password: text("password"), // Optional - can be null for phone-only auth
  name: text("name").notNull(),
  phone: text("phone").notNull(), // Required and unique for phone-only auth
  role: text("role").notNull().default("customer"),
  emailVerified: boolean("email_verified").notNull().default(false),
  phoneVerified: boolean("phone_verified").notNull().default(false),
  biometricEnabled: boolean("biometric_enabled").notNull().default(false), // For biometric authentication
  verificationCode: text("verification_code"),
  verificationExpires: timestamp("verification_expires"),
  pagoMovilPhone: text("pago_movil_phone"),
  pagoMovilBank: text("pago_movil_bank"),
  pagoMovilCedula: text("pago_movil_cedula"),
  bankAccount: text("bank_account"),
  isActive: boolean("is_active").notNull().default(true), // Para desactivar cuentas
  isOnline: boolean("is_online").notNull().default(false), // Para repartidores online/offline
  lastActiveAt: timestamp("last_active_at"), // Última actividad
  profileImage: text("profile_image"), // URL de imagen de perfil
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const addresses = mysqlTable("addresses", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  userId: varchar("user_id", { length: 255 }).notNull(),
  label: text("label").notNull(),
  street: text("street").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  zipCode: text("zip_code"),
  isDefault: boolean("is_default").notNull().default(false),
  latitude: text("latitude"),
  longitude: text("longitude"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const orders = mysqlTable("orders", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  userId: varchar("user_id", { length: 255 }).notNull(),
  businessId: text("business_id").notNull(),
  businessName: text("business_name").notNull(),
  businessImage: text("business_image"),
  items: text("items").notNull(),
  status: text("status").notNull().default("pending"), // pending, accepted, preparing, on_the_way, delivered, cancelled
  subtotal: int("subtotal").notNull(),
  productosBase: int("productos_base").default(0), // Precio base sin markup MOUZO
  nemyCommission: int("nemy_commission").default(0), // 15% markup MOUZO
  deliveryFee: int("delivery_fee").notNull(),
  total: int("total").notNull(),
  paymentMethod: text("payment_method").notNull(),
  pagoMovilReference: text("pago_movil_reference"),
  pagoMovilProofUrl: text("pago_movil_proof_url"),
  pagoMovilPhone: text("pago_movil_phone"),
  pagoMovilBank: text("pago_movil_bank"),
  pagoMovilStatus: text("pago_movil_status").default("pending"),
  pagoMovilVerifiedBy: varchar("pago_movil_verified_by", { length: 255 }),
  pagoMovilVerifiedAt: timestamp("pago_movil_verified_at"),
  pagoMovilRejectedReason: text("pago_movil_rejected_reason"),
  deliveryAddress: text("delivery_address").notNull(),
  deliveryPersonId: text("delivery_person_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  estimatedDelivery: timestamp("estimated_delivery"),
  // Campos para cancelación y comisiones
  cancelledAt: timestamp("cancelled_at"),
  cancelledBy: varchar("cancelled_by", { length: 255 }),
  cancellationReason: text("cancellation_reason"),
  refundAmount: int("refund_amount"),
  penaltyAmount: int("penalty_amount"), // penalización por cancelación
  refundStatus: text("refund_status"), // pending, processed, failed
  businessResponseAt: timestamp("business_response_at"), // cuando el negocio respondió
  platformFee: int("platform_fee"), // comisión MOUZO
  businessEarnings: int("business_earnings"), // ganancia negocio
  deliveryEarnings: int("delivery_earnings"), // ganancia repartidor
  distanceKm: int("distance_km"), // distancia en metros x100
  deliveredAt: timestamp("delivered_at"), // cuando se entregó
  deliveryLatitude: text("delivery_latitude"),
  deliveryLongitude: text("delivery_longitude"),
  // Preferencias de sustitución (Stock Out)
  substitutionPreference: text("substitution_preference").default("refund"), // refund, call, substitute
  itemSubstitutionPreferences: text("item_substitution_preferences"), // JSON: {productId: "refund"|"call"|"substitute"}
  // Pago en efectivo
  cashPaymentAmount: int("cash_payment_amount"), // Con cuánto paga el cliente (centavos)
  cashChangeAmount: int("cash_change_amount"), // Cambio a entregar (centavos)
  // Cronómetro de arrepentimiento
  regretPeriodEndsAt: timestamp("regret_period_ends_at"), // Cuando termina el periodo de 60s
  confirmedToBusinessAt: timestamp("confirmed_to_business_at"), // Cuando se notificó al negocio
  // Llamada automática al negocio
  callAttempted: boolean("call_attempted").default(false), // Si ya se intentó llamar al negocio
  callAttemptedAt: timestamp("call_attempted_at"), // Cuando se intentó la llamada
  // Campos adicionales de pago
  paidAt: timestamp("paid_at"),
  refundedAt: timestamp("refunded_at"),
  driverPaidAt: timestamp("driver_paid_at"),
  driverPaymentStatus: text("driver_payment_status").default("pending"),
  // Confirmación de recepción por cliente
  confirmedByCustomer: boolean("confirmed_by_customer").default(false), // Si el cliente confirmó recepción
  confirmedByCustomerAt: timestamp("confirmed_by_customer_at"), // Cuándo confirmó
  fundsReleased: boolean("funds_released").default(false), // Si ya se liberaron los fondos
  fundsReleasedAt: timestamp("funds_released_at"), // Cuándo se liberaron
  businessTransferId: text("business_transfer_id"), // ID de transfer a negocio
  driverTransferId: text("driver_transfer_id"), // ID de transfer a repartidor
  // Asignación de repartidor
  assignedAt: timestamp("assigned_at"), // Cuando se asignó el repartidor
  driverPickedUpAt: timestamp("driver_picked_up_at"), // Cuando repartidor recogió el pedido
  driverArrivedAt: timestamp("driver_arrived_at"), // Cuando repartidor llegó con el cliente
  // Liquidación de efectivo (para pedidos cash)
  cashCollected: boolean("cash_collected").default(false), // Si el repartidor ya cobró el efectivo
  cashSettled: boolean("cash_settled").default(false), // Si ya liquidó con negocio/plataforma
  cashSettledAt: timestamp("cash_settled_at"), // Cuando liquidó
  // Prueba de entrega
  deliveryProofPhoto: text("delivery_proof_photo"), // URL de foto de entrega
  deliveryProofPhotoTimestamp: timestamp("delivery_proof_photo_timestamp"),
  deliveryRoute: text("delivery_route"), // JSON con ruta completa del repartidor
  deliveryDistance: int("delivery_distance"), // Distancia real recorrida en metros
  // Validación GPS
  deliveryGpsAccuracy: int("delivery_gps_accuracy"), // Precisión del GPS en metros
  deliveryGpsValidated: boolean("delivery_gps_validated").default(false), // Si se validó la ubicación
  // Compartir tracking
  trackingToken: varchar("tracking_token", { length: 255 }), // Token para compartir tracking
  trackingTokenExpires: timestamp("tracking_token_expires"),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
});

export const businesses = mysqlTable("businesses", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  ownerId: varchar("owner_id", { length: 255 }),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull().default("restaurant"), // restaurant, market
  image: text("image"),
  coverImage: text("cover_image"),
  address: text("address"),
  phone: text("phone"),
  phoneVerified: boolean("phone_verified").notNull().default(false),
  email: text("email"),
  rating: int("rating").default(0), // stored as 0-50 (for 0.0-5.0)
  totalRatings: int("total_ratings").default(0),
  deliveryTime: text("delivery_time").default("30-45 min"),
  deliveryFee: int("delivery_fee").default(2500), // in cents
  minOrder: int("min_order").default(5000), // in cents
  isActive: boolean("is_active").notNull().default(true),
  isOpen: boolean("is_open").notNull().default(true),
  openingHours: text("opening_hours"), // JSON string
  categories: text("categories"), // comma-separated
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  // Campos para ubicación y zonas de entrega
  latitude: text("latitude"),
  longitude: text("longitude"),
  maxDeliveryRadiusKm: int("max_delivery_radius_km").default(10), // Radio máximo de entrega
  baseFeePerKm: int("base_fee_per_km").default(500), // Costo por km en centavos
  verificationStatus: text("verification_status").default("pending"), // pending, verified, rejected
  verificationDocuments: text("verification_documents"), // JSON con URLs de documentos
  // Control operativo de negocios
  maxSimultaneousOrders: int("max_simultaneous_orders").default(10), // Límite de pedidos activos
  isPaused: boolean("is_paused").notNull().default(false), // Pausado por sistema o manual
  pauseReason: text("pause_reason"), // Razón de pausa: manual, too_many_orders, delayed_orders
  pausedAt: timestamp("paused_at"),
  pausedUntil: timestamp("paused_until"), // Pausa temporal
  autoResumeEnabled: boolean("auto_resume_enabled").notNull().default(true),
  isFeatured: boolean("is_featured").notNull().default(false), // Destacado en pantalla de login
  featuredOrder: int("featured_order").default(0), // Orden de aparición en carrusel
  // Modo Slammed (Saturado)
  isSlammed: boolean("is_slammed").notNull().default(false), // Negocio saturado
  slammedExtraMinutes: int("slammed_extra_minutes").default(20), // Minutos extra cuando está saturado
  slammedAt: timestamp("slammed_at"), // Cuando se activó el modo saturado
  pagoMovilPhone: text("pago_movil_phone"),
  pagoMovilBank: text("pago_movil_bank"),
  pagoMovilCedula: text("pago_movil_cedula"),
  verificationCode: text("verification_code"),
  verificationExpires: timestamp("verification_expires"),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
});

// Wallets - billetera para cada usuario
export const wallets = mysqlTable("wallets", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  userId: varchar("user_id", { length: 255 }).notNull(),
  balance: int("balance").notNull().default(0), // en centavos - saldo disponible
  pendingBalance: int("pending_balance").notNull().default(0), // dinero en tránsito
  cashOwed: int("cash_owed").notNull().default(0), // efectivo que debe liquidar (para repartidores)
  totalEarned: int("total_earned").notNull().default(0),
  totalWithdrawn: int("total_withdrawn").notNull().default(0),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(
    sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
  ),
});

// Transactions - registro contable de todas las transacciones
export const transactions = mysqlTable("transactions", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  walletId: varchar("wallet_id", { length: 255 }),
  orderId: varchar("order_id", { length: 255 }),
  businessId: varchar("business_id", { length: 255 }),
  userId: varchar("user_id", { length: 255 }),
  type: text("type").notNull(), // income, commission, withdrawal, refund, penalty, tip, payment, transfer, delivery_payment
  amount: int("amount").notNull(), // en centavos (positivo = ingreso, negativo = egreso)
  balanceBefore: int("balance_before"),
  balanceAfter: int("balance_after"),
  description: text("description"),
  status: text("status").notNull().default("completed"), // pending, completed, failed, cancelled
  metadata: text("metadata"), // JSON con info adicional
  pagoMovilReference: text("pago_movil_reference"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
});

// Payments - registro de pagos de Stripe
export const payments = mysqlTable("payments", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  orderId: varchar("order_id", { length: 255 }).notNull(),
  customerId: varchar("customer_id", { length: 255 }).notNull(),
  businessId: varchar("business_id", { length: 255 }).notNull(),
  driverId: varchar("driver_id", { length: 255 }),
  amount: int("amount").notNull(), // en centavos
  currency: text("currency").notNull().default("VES"),
  status: text("status").notNull().default("pending"),
  paymentMethod: text("payment_method").notNull().default("pago_movil"),
  pagoMovilReference: text("pago_movil_reference"),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
});

// Alias para compatibilidad con paymentService.ts
export const walletTransactions = transactions;

// Base insert schema - phone and name are required, email/password are optional
export const insertUserSchema = createInsertSchema(users)
  .pick({
    email: true,
    password: true,
    name: true,
    phone: true,
    role: true,
  })
  .extend({
    phone: z.string().min(10, "Phone number is required"),
    name: z.string().min(1, "Name is required"),
    email: z.string().email().optional().nullable(),
    password: z.string().optional().nullable(),
  });

export const insertOrderSchema = createInsertSchema(orders).pick({
  userId: true,
  businessId: true,
  businessName: true,
  businessImage: true,
  items: true,
  status: true,
  subtotal: true,
  deliveryFee: true,
  total: true,
  paymentMethod: true,
  paymentIntentId: true,
  deliveryAddress: true,
  notes: true,
  substitutionPreference: true,
  itemSubstitutionPreferences: true,
  cashPaymentAmount: true,
  cashChangeAmount: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;
export type Business = typeof businesses.$inferSelect;
export type Wallet = typeof wallets.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;

// System Settings - Configuración global del sistema
export const systemSettings = mysqlTable("system_settings", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  key: varchar("key", { length: 255 }).notNull().unique(),
  value: text("value").notNull(),
  type: text("type").notNull().default("string"), // string, number, boolean, json
  category: text("category").notNull(), // payments, commissions, operations, security
  description: text("description"),
  isPublic: boolean("is_public").notNull().default(false), // Si es visible para clientes
  updatedBy: varchar("updated_by", { length: 255 }),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(
    sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
  ),
});

// Products - Productos de negocios
export const products = mysqlTable("products", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  businessId: varchar("business_id", { length: 255 }).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  price: int("price").notNull(), // en centavos
  image: text("image"),
  category: text("category"),
  isAvailable: boolean("is_available").notNull().default(true),
  is86: boolean("is_86").notNull().default(false), // Menú 86 (agotado temporalmente)
  soldByWeight: boolean("sold_by_weight").notNull().default(false),
  weightUnit: text("weight_unit").default("kg"), // kg, lb, g
  stock: int("stock"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(
    sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
  ),
});

// Pago Móvil Verifications
export const pagoMovilVerifications = mysqlTable("pago_movil_verifications", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`(UUID())`),
  orderId: varchar("order_id", { length: 255 }).notNull(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  reference: varchar("reference", { length: 50 }).notNull().unique(),
  amount: int("amount").notNull(),
  proofUrl: text("proof_url"),
  clientPhone: varchar("client_phone", { length: 20 }),
  clientBank: varchar("client_bank", { length: 50 }),
  destPhone: varchar("dest_phone", { length: 20 }),
  destBank: varchar("dest_bank", { length: 50 }),
  destCedula: varchar("dest_cedula", { length: 20 }),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  verifiedBy: varchar("verified_by", { length: 255 }),
  verifiedAt: timestamp("verified_at"),
  rejectedReason: text("rejected_reason"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
});

// Withdrawals - Retiros de fondos
export const withdrawals = mysqlTable("withdrawals", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  walletId: varchar("wallet_id", { length: 255 }).notNull(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  amount: int("amount").notNull(), // en centavos
  status: varchar("status", { length: 50 }).notNull().default("pending"), // pending, processing, completed, failed, cancelled
  method: varchar("method", { length: 50 }).notNull().default("pago_movil"),
  bankAccount: text("bank_account"), // JSON con datos bancarios
  failureReason: text("failure_reason"),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

// Withdrawal Requests - Solicitudes de retiro con detalles bancarios
export const withdrawalRequests = mysqlTable("withdrawal_requests", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  userId: varchar("user_id", { length: 255 }).notNull(),
  walletId: varchar("wallet_id", { length: 255 }).notNull(),
  amount: int("amount").notNull(), // en centavos
  method: varchar("method", { length: 50 }).notNull(), // stripe, bank_transfer
  status: varchar("status", { length: 50 }).notNull().default("pending"), // pending, completed, failed, cancelled
  pagoMovilPhone: varchar("pago_movil_phone", { length: 20 }),
  pagoMovilBank: varchar("pago_movil_bank", { length: 50 }),
  pagoMovilCedula: varchar("pago_movil_cedula", { length: 20 }),
  accountHolder: text("account_holder"),
  // Admin
  approvedBy: varchar("approved_by", { length: 255 }),
  errorMessage: text("error_message"),
  requestedAt: timestamp("requested_at").default(sql`CURRENT_TIMESTAMP`),
  completedAt: timestamp("completed_at"),
});

// Delivery Drivers - Repartidores
export const deliveryDrivers = mysqlTable("delivery_drivers", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  userId: varchar("user_id", { length: 255 }).notNull().unique(),
  vehicleType: text("vehicle_type").notNull(), // bike, motorcycle, car
  vehiclePlate: text("vehicle_plate"),
  isAvailable: boolean("is_available").notNull().default(false),
  currentLatitude: text("current_latitude"),
  currentLongitude: text("current_longitude"),
  lastLocationUpdate: timestamp("last_location_update"),
  totalDeliveries: int("total_deliveries").notNull().default(0),
  rating: int("rating").default(0), // stored as 0-50 (for 0.0-5.0)
  totalRatings: int("total_ratings").default(0),
  strikes: int("strikes").notNull().default(0), // Sistema de strikes
  isBlocked: boolean("is_blocked").notNull().default(false),
  blockedReason: text("blocked_reason"),
  blockedUntil: timestamp("blocked_until"),
  // GPS tracking y ruta
  routeHistory: text("route_history"), // JSON con historial de rutas
  totalDistanceTraveled: int("total_distance_traveled").default(0), // metros totales
  averageSpeed: int("average_speed").default(0), // km/h promedio
  gpsAccuracyAverage: int("gps_accuracy_average").default(0), // precisión promedio en metros
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

// Audit Logs - Logs de auditoría para acciones críticas
export const auditLogs = mysqlTable("audit_logs", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  userId: varchar("user_id", { length: 255 }).notNull(),
  action: text("action").notNull(), // create_order, cancel_order, update_settings, etc
  entityType: text("entity_type").notNull(), // order, user, business, settings
  entityId: varchar("entity_id", { length: 255 }),
  changes: text("changes"), // JSON con cambios realizados
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export type SystemSetting = typeof systemSettings.$inferSelect;
export type Product = typeof products.$inferSelect;
export type PagoMovilVerification = typeof pagoMovilVerifications.$inferSelect;
export type Withdrawal = typeof withdrawals.$inferSelect;
export type WithdrawalRequest = typeof withdrawalRequests.$inferSelect;
export type DeliveryDriver = typeof deliveryDrivers.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type Payment = typeof payments.$inferSelect;

// Alias para compatibilidad
export const drivers = deliveryDrivers;

// Refresh Tokens - Tokens de refresco para autenticación
export const refreshTokens = mysqlTable("refresh_tokens", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  userId: varchar("user_id", { length: 255 }).notNull(),
  token: text("token").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  revoked: boolean("revoked").notNull().default(false),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

// Scheduled Orders - Pedidos programados
export const scheduledOrders = mysqlTable("scheduled_orders", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  userId: varchar("user_id", { length: 255 }).notNull(),
  businessId: varchar("business_id", { length: 255 }).notNull(),
  items: text("items").notNull(), // JSON
  scheduledFor: timestamp("scheduled_for").notNull(),
  deliveryAddress: text("delivery_address").notNull(),
  deliveryLatitude: text("delivery_latitude"),
  deliveryLongitude: text("delivery_longitude"),
  paymentMethod: text("payment_method").notNull(),
  notes: text("notes"),
  status: text("status").notNull().default("pending"), // pending, processed, failed, cancelled
  orderId: varchar("order_id", { length: 255 }), // ID del pedido creado
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

// Support Chats - Chats de soporte con IA
export const supportChats = mysqlTable("support_chats", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  userId: varchar("user_id", { length: 255 }).notNull(),
  status: text("status").notNull().default("active"), // active, closed, escalated
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(
    sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
  ),
});

// Support Messages - Mensajes de chat de soporte
export const supportMessages = mysqlTable("support_messages", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  chatId: varchar("chat_id", { length: 255 }).notNull(),
  userId: varchar("user_id", { length: 255 }), // null si es del bot
  message: text("message").notNull(),
  isBot: boolean("is_bot").notNull().default(false),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

// Reviews - Reseñas de pedidos
export const reviews = mysqlTable("reviews", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  userId: varchar("user_id", { length: 255 }).notNull(),
  orderId: varchar("order_id", { length: 255 }).notNull(),
  businessId: varchar("business_id", { length: 255 }).notNull(),
  rating: int("rating").notNull(), // 1-5
  comment: text("comment"),
  approved: boolean("approved").notNull().default(true),
  flagged: boolean("flagged").notNull().default(false),
  moderationReason: text("moderation_reason"),
  businessResponse: text("business_response"),
  businessResponseAt: timestamp("business_response_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

// Call logs for automatic business calls
export const callLogs = mysqlTable("call_logs", {
  id: varchar("id", { length: 255 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  orderId: varchar("order_id", { length: 255 }).notNull(),
  businessId: varchar("business_id", { length: 255 }).notNull(),
  callSid: varchar("call_sid", { length: 255 }),
  phoneNumber: varchar("phone_number", { length: 50 }),
  purpose: varchar("purpose", { length: 50 }).default("order_notification"), // order_notification, reminder
  status: varchar("status", { length: 50 }).default("initiated"), // initiated, ringing, answered, completed, failed, no-answer
  duration: int("duration"), // in seconds
  outcome: varchar("outcome", { length: 50 }), // accepted, rejected, no-answer
  response: varchar("response", { length: 10 }), // digits pressed by business
  responseAction: varchar("response_action", { length: 50 }), // accept, reject
  retryCount: int("retry_count").default(0),
  error: text("error"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  completedAt: timestamp("completed_at"),
  updatedAt: timestamp("updated_at"),
});

export type RefreshToken = typeof refreshTokens.$inferSelect;
export type ScheduledOrder = typeof scheduledOrders.$inferSelect;
export type SupportChat = typeof supportChats.$inferSelect;
export type SupportMessage = typeof supportMessages.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type CallLog = typeof callLogs.$inferSelect;

// Delivery Zones - Zonas de entrega
export const deliveryZones = mysqlTable("delivery_zones", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  name: text("name").notNull(),
  description: text("description"),
  deliveryFee: int("deliveryFee").notNull(), // en centavos
  maxDeliveryTime: int("maxDeliveryTime").default(45), // minutos
  isActive: boolean("isActive").notNull().default(true),
  coordinates: text("coordinates"), // JSON con polígono de coordenadas
  centerLatitude: text("centerLatitude"),
  centerLongitude: text("centerLongitude"),
  radiusKm: int("radiusKm").default(5),
  createdAt: timestamp("createdAt").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updatedAt").default(
    sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
  ),
});

export type DeliveryZone = typeof deliveryZones.$inferSelect;

// Coupons - Cupones de descuento
export const coupons = mysqlTable("coupons", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  code: varchar("code", { length: 50 }).notNull().unique(),
  discountType: varchar("discount_type", { length: 20 }).notNull(), // percentage, fixed
  discountValue: int("discount_value").notNull(), // en centavos o porcentaje
  minOrderAmount: int("min_order_amount").default(0), // mínimo de pedido en centavos
  maxUses: int("max_uses"), // null = ilimitado
  maxUsesPerUser: int("max_uses_per_user").default(1),
  usedCount: int("used_count").notNull().default(0),
  expiresAt: timestamp("expires_at"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(
    sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
  ),
});

export type Coupon = typeof coupons.$inferSelect;

// Favorites - Favoritos de usuarios (negocios y productos)
export const favorites = mysqlTable("favorites", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  userId: varchar("user_id", { length: 255 }).notNull(),
  businessId: varchar("business_id", { length: 255 }),
  productId: varchar("product_id", { length: 255 }),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export type Favorite = typeof favorites.$inferSelect;

// Delivery Heatmap - Mapa de calor de entregas
export const deliveryHeatmap = mysqlTable("delivery_heatmap", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  latitude: text("latitude").notNull(),
  longitude: text("longitude").notNull(),
  orderCount: int("order_count").notNull().default(1),
  totalRevenue: int("total_revenue").notNull().default(0), // en centavos
  averageDeliveryTime: int("average_delivery_time").default(0), // en segundos
  lastOrderAt: timestamp("last_order_at"),
  gridCell: varchar("grid_cell", { length: 50 }), // Para agrupar por celda de grid
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(
    sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
  ),
});

export type DeliveryHeatmap = typeof deliveryHeatmap.$inferSelect;

// Proximity Alerts - Alertas de proximidad
export const proximityAlerts = mysqlTable("proximity_alerts", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  orderId: varchar("order_id", { length: 255 }).notNull(),
  driverId: varchar("driver_id", { length: 255 }).notNull(),
  alertType: varchar("alert_type", { length: 50 }).notNull(), // approaching, nearby, arrived
  distance: int("distance").notNull(), // metros
  destinationType: varchar("destination_type", { length: 50 }).notNull(), // business, customer
  notificationSent: boolean("notification_sent").default(false),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export type ProximityAlert = typeof proximityAlerts.$inferSelect;

// Delivery Proofs - Pruebas de entrega con foto
export const deliveryProofs = mysqlTable("delivery_proofs", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  orderId: varchar("order_id", { length: 255 }).notNull().unique(),
  driverId: varchar("driver_id", { length: 255 }).notNull(),
  photoUrl: text("photo_url").notNull(),
  photoBase64: text("photo_base64"), // Backup en base64
  latitude: text("latitude").notNull(),
  longitude: text("longitude").notNull(),
  accuracy: int("accuracy"), // Precisión GPS en metros
  route: text("route"), // JSON con breadcrumbs de la ruta
  routeDistance: int("route_distance"), // Distancia total en metros
  timestamp: timestamp("timestamp").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export type DeliveryProof = typeof deliveryProofs.$inferSelect;
