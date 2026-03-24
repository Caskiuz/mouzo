import express from "express";
import { authenticateToken } from "./authMiddleware";

// ─── Route modules ────────────────────────────────────────────────────────────
import authRoutes from "./routes/auth";
import businessRoutes from "./routes/business";
import orderRoutes from "./routes/orderRoutes";
import userRoutes from "./routes/users";
import deliveryRoutes from "./routes/delivery";
import paymentRoutes from "./routes/payments";
import walletRoutes from "./routes/wallet";
import adminRoutes from "./routes/adminRoutes";
import adminFinanceRoutes from "./routes/adminFinanceRoutes";
import walletRoutesV2 from "./routes/walletRoutes";
import bankAccountRoutes from "./routes/bankAccountRoutes";
import deliveryConfigRoutes from "./routes/deliveryConfigRoutes";
import businessVerificationRoutes from "./routes/businessVerificationRoutes";
import supportRoutes from "./supportRoutes";
import withdrawalRoutes from "./withdrawalRoutes";
import cashSettlementRoutes from "./cashSettlementRoutes";
import weeklySettlementRoutes from "./weeklySettlementRoutes";
import financialAuditRoutes from "./financialAuditRoutes";
import favoritesRoutes from "./favoritesRoutes";
import deliveryRoutesLegacy from "./deliveryRoutes";
import gpsRoutes from "./gpsRoutes";
import pagoMovilRoutes from "./pagoMovilRoutes";
import digitalPaymentRoutes from "./routes/digitalPayments";
import fundReleaseRoutes from "./routes/fundRelease";
import payoutRoutes from "./payoutRoutes";
import searchRoutes from "./routes/search";
import couponRoutes from "./routes/coupons";
import loyaltyRoutes from "./routes/loyalty";
import favoritesRoutesV2 from "./routes/favorites";
import scheduledOrdersRoutes from "./routes/scheduledOrders";
import aiRecommendationsRoutes from "./routes/aiRecommendations";
import supportRoutesV2 from "./routes/support";
import enhancedTrackingRoutes from "./routes/enhancedTracking";
import subscriptionRoutes from "./routes/subscriptions";
import smartNotificationRoutes from "./routes/smartNotifications";
import enhancedReviewsRoutes from "./routes/enhancedReviews";
import businessAnalyticsRoutes from "./routes/businessAnalytics";

const router = express.Router();

// ─── Health ───────────────────────────────────────────────────────────────────
router.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString(), environment: process.env.NODE_ENV });
});

// ─── Public settings ──────────────────────────────────────────────────────────
router.get("/settings/public", async (req, res) => {
  try {
    const { getPublicSettings } = await import("./systemSettingsService");
    const result = await getPublicSettings();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Coupon validation ────────────────────────────────────────────────────────
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

// ─── Delivery zones (public) ──────────────────────────────────────────────────
router.get("/delivery-zones", async (_req, res) => {
  res.json({
    success: true,
    zones: [
      { id: "zone-centro", name: "Centro",        deliveryFee: 2500, maxDeliveryTime: 30, isActive: true, centerLatitude: "7.7669",  centerLongitude: "-72.2251", radiusKm: 3 },
      { id: "zone-norte",  name: "Norte",          deliveryFee: 3000, maxDeliveryTime: 35, isActive: true, centerLatitude: "7.7730",  centerLongitude: "-72.2251", radiusKm: 4 },
      { id: "zone-sur",    name: "Sur",            deliveryFee: 3000, maxDeliveryTime: 35, isActive: true, centerLatitude: "7.7600",  centerLongitude: "-72.2251", radiusKm: 4 },
      { id: "zone-este",   name: "Este",           deliveryFee: 3500, maxDeliveryTime: 40, isActive: true, centerLatitude: "7.7669",  centerLongitude: "-72.2100", radiusKm: 4 },
    ],
  });
});

// ─── Favorites stubs ──────────────────────────────────────────────────────────
router.get("/favorites/check/:userId/:businessId", (_req, res) => res.json({ success: true, isFavorite: false }));
router.get("/favorites/:userId", (_req, res) => res.json({ success: true, favorites: [] }));
router.post("/favorites", (_req, res) => res.json({ success: true }));
router.delete("/favorites/:userId/:businessId", (_req, res) => res.json({ success: true }));

// ─── Levels stub ──────────────────────────────────────────────────────────────
router.get("/levels/my-level", (_req, res) => res.json({ success: true, level: null }));

// ─── Core route modules ───────────────────────────────────────────────────────
router.use("/auth",                  authRoutes);
router.use("/businesses",            businessRoutes);
router.use("/business",              businessRoutes);
router.use("/orders",                orderRoutes);
router.use("/users",                 userRoutes);
router.use("/user",                  userRoutes);
router.use("/delivery",              deliveryRoutes);
router.use("/delivery",              deliveryRoutesLegacy);
router.use("/delivery",              deliveryConfigRoutes);
router.use("/payments",              paymentRoutes);
router.use("/pago-movil",            pagoMovilRoutes);
router.use("/digital-payments",      digitalPaymentRoutes);
router.use("/fund-release",          fundReleaseRoutes);
router.use("/payouts",               payoutRoutes);
router.use("/wallet",                walletRoutes);
router.use("/wallet",                walletRoutesV2);
router.use("/bank-account",          bankAccountRoutes);
router.use("/admin",                 adminRoutes);
router.use("/admin/finance",         adminFinanceRoutes);
router.use("/support",               supportRoutes);
router.use("/withdrawals",           withdrawalRoutes);
router.use("/cash-settlement",       cashSettlementRoutes);
router.use("/weekly-settlement",     weeklySettlementRoutes);
router.use("/audit",                 financialAuditRoutes);
router.use("/favorites",             favoritesRoutes);
router.use("/business-verification", businessVerificationRoutes);
router.use("/gps",                   gpsRoutes);
router.use("/search",                searchRoutes);
router.use("/coupons",               couponRoutes);
router.use("/loyalty",               loyaltyRoutes);
router.use("/favorites",             favoritesRoutesV2);
router.use("/scheduled-orders",      scheduledOrdersRoutes);
router.use("/ai",                    aiRecommendationsRoutes);
router.use("/support",               supportRoutesV2);
router.use("/tracking",              enhancedTrackingRoutes);
router.use("/subscriptions",        subscriptionRoutes);
router.use("/smart-notifications",  smartNotificationRoutes);
router.use("/reviews",              enhancedReviewsRoutes);
router.use("/analytics",            businessAnalyticsRoutes);

export default router;
