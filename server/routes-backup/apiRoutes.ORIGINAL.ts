import express from "express";
import { authenticateToken, requireRole, requireMinRole } from "./authMiddleware";

// Import route modules
import authRoutes from "./routes/authRoutes";
import ordersRoutes from "./routes/ordersRoutes";
import businessesRoutes from "./routes/businessesRoutes";
import deliveryRoutes from "./routes/deliveryRoutes";
import usersRoutes from "./routes/usersRoutes";

// Import existing route modules
import walletRoutes from "./routes/walletRoutes";
import bankAccountRoutes from "./routes/bankAccountRoutes";
import supportRoutes from "./supportRoutes";
import adminRoutes from "./routes/adminRoutes";
import deliveryConfigRoutes from "./routes/deliveryConfigRoutes";
import stripePaymentRoutes from "./routes/stripePaymentRoutes";
import businessVerificationRoutes from "./routes/businessVerificationRoutes";
import financialAuditRoutes from "./financialAuditRoutes";
import weeklySettlementRoutes from "./weeklySettlementRoutes";
import cashSettlementRoutes from "./cashSettlementRoutes";
import withdrawalRoutes from "./withdrawalRoutes";

const router = express.Router();

// Health check
router.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// Public settings
router.get("/settings/public", async (req, res) => {
  const { getPublicSettings } = await import("./systemSettingsService");
  const result = await getPublicSettings();
  res.json(result);
});

// Featured businesses
router.get("/businesses/featured", async (req, res) => {
  try {
    const { businesses } = await import("@shared/schema-mysql");
    const { db } = await import("./db");
    const { eq, and } = await import("drizzle-orm");
    
    const featuredBusinesses = await db
      .select()
      .from(businesses)
      .where(and(eq(businesses.isFeatured, true), eq(businesses.isActive, true)))
      .limit(10);
    
    res.json({ success: true, businesses: featuredBusinesses });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Validate coupon
router.post("/coupons/validate", authenticateToken, async (req, res) => {
  try {
    const { validateCoupon } = await import("./couponService");
    const { code, userId, orderTotal } = req.body;
    
    const result = await validateCoupon(code, userId || req.user!.id, orderTotal);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ valid: false, error: error.message });
  }
});

// Stripe webhooks
router.post("/webhooks/stripe", async (req, res) => {
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(503).json({ error: "Stripe not configured" });
  }
  try {
    const { handleStripeWebhook } = await import("./stripeWebhooksComplete");
    return handleStripeWebhook(req, res);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Connect routes
router.get("/connect/status", authenticateToken, async (req, res) => {
  try {
    console.log('🔗 GET /api/connect/status called for user:', req.user?.id);
    const { getConnectStatus } = await import("./stripeConnectService");
    const result = await getConnectStatus(req.user!.id);
    res.json(result);
  } catch (error: any) {
    console.error('Connect status error:', error);
    res.status(500).json({ error: error.message || 'Failed to get account status' });
  }
});

// Delivery zones (public)
router.get("/delivery-zones", async (req, res) => {
  try {
    console.log('📍 GET /delivery-zones called');
    
    const zones = [
      {
        id: 'zone-centro',
        name: 'Centro',
        description: 'Centro de San Cristóbal',
        deliveryFee: 2500,
        maxDeliveryTime: 30,
        isActive: true,
        centerLatitude: '20.6736',
        centerLongitude: '-104.3647',
        radiusKm: 3
      },
      {
        id: 'zone-norte',
        name: 'Norte',
        description: 'Zona Norte de San Cristóbal',
        deliveryFee: 3000,
        maxDeliveryTime: 35,
        isActive: true,
        centerLatitude: '20.6800',
        centerLongitude: '-104.3647',
        radiusKm: 4
      },
      {
        id: 'zone-sur',
        name: 'Sur',
        description: 'Zona Sur de San Cristóbal',
        deliveryFee: 3000,
        maxDeliveryTime: 35,
        isActive: true,
        centerLatitude: '20.6672',
        centerLongitude: '-104.3647',
        radiusKm: 4
      }
    ];
    
    console.log('✅ Found', zones.length, 'active delivery zones (hardcoded)');
    res.json({ success: true, zones });
  } catch (error: any) {
    console.error('❌ Error fetching delivery zones:', error);
    res.status(500).json({ error: error.message });
  }
});

// Test routes (development only)
if (process.env.NODE_ENV === "development") {
  router.get("/test-wallet/:userId", async (req, res) => {
    try {
      const { wallets } = await import("@shared/schema-mysql");
      const { db } = await import("./db");
      const { eq } = await import("drizzle-orm");

      const [wallet] = await db
        .select()
        .from(wallets)
        .where(eq(wallets.userId, req.params.userId))
        .limit(1);

      res.json({
        found: !!wallet,
        wallet: wallet,
        balancePesos: wallet ? wallet.balance / 100 : 0,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get("/auth/test-users", async (req, res) => {
    try {
      const { users } = await import("@shared/schema-mysql");
      const { db } = await import("./db");
      
      const allUsers = await db
        .select({
          id: users.id,
          name: users.name,
          phone: users.phone,
          role: users.role,
        })
        .from(users);
      
      res.json({ users: allUsers });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
}

// Register route modules
router.use("/auth", authRoutes);
router.use("/orders", ordersRoutes);
router.use("/businesses", businessesRoutes);
router.use("/business", businessesRoutes); // Alias para compatibilidad
router.use("/delivery", deliveryRoutes);
router.use("/users", usersRoutes);

// Register existing route modules
router.use("/wallet", walletRoutes);
router.use("/bank-account", bankAccountRoutes);
router.use("/support", supportRoutes);
router.use("/admin", adminRoutes);
router.use("/delivery", deliveryConfigRoutes);
router.use("/cash-settlement", cashSettlementRoutes);
router.use("/withdrawals", withdrawalRoutes);
router.use("/weekly-settlement", weeklySettlementRoutes);
router.use("/stripe", stripePaymentRoutes);
router.use("/business-verification", businessVerificationRoutes);
router.use("/audit", financialAuditRoutes);

// Quick audit endpoint
router.get('/audit/quick', async (req, res) => {
  try {
    const { db } = await import("./db");
    const { sql } = await import("drizzle-orm");
    
    const checks = [];
    let allPassed = true;
    
    // Check orders exist
    const [orderCount] = await db.execute(sql`SELECT COUNT(*) as count FROM orders`);
    const hasOrders = orderCount.count > 0;
    checks.push({
      rule: 'Hay pedidos en el sistema',
      passed: hasOrders,
      details: `${orderCount.count} pedidos encontrados`
    });
    if (!hasOrders) allPassed = false;
    
    // Check payments vs orders
    const [paymentCount] = await db.execute(sql`SELECT COUNT(*) as count FROM payments`);
    const paymentsMatch = paymentCount.count === orderCount.count;
    checks.push({
      rule: 'Pagos coinciden con pedidos',
      passed: paymentsMatch,
      details: `${paymentCount.count} pagos vs ${orderCount.count} pedidos`
    });
    if (!paymentsMatch) allPassed = false;
    
    // Check transactions
    const [txCount] = await db.execute(sql`SELECT COUNT(*) as count FROM transactions`);
    const hasTransactions = txCount.count > 0;
    checks.push({
      rule: 'Se generaron transacciones',
      passed: hasTransactions,
      details: `${txCount.count} transacciones generadas`
    });
    if (!hasTransactions) allPassed = false;
    
    // Check active wallets
    const [walletCount] = await db.execute(sql`
      SELECT COUNT(*) as count 
      FROM wallets 
      WHERE balance > 0 OR pending_balance > 0 OR total_earned > 0
    `);
    const walletsActive = walletCount.count > 0;
    checks.push({
      rule: 'Wallets tienen movimientos',
      passed: walletsActive,
      details: `${walletCount.count} wallets con actividad`
    });
    if (!walletsActive) allPassed = false;
    
    res.json({
      overall_status: allPassed ? 'PASSED' : 'FAILED',
      checks,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('Error en auditoría rápida:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;