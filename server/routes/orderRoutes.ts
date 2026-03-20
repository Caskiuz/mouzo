import express from "express";
import { authenticateToken, requireRole, auditAction } from "../authMiddleware";
import { 
  validateOrderFinancials, 
  validateOrderCompletion 
} from "../financialMiddleware";
import {
  validateDriverOrderOwnership,
  validateCustomerOrderOwnership,
} from "../validateOwnership";
import { calculateDistance, calculateDeliveryFee, estimateDeliveryTime } from "../utils/distance";
import { getDeliveryConfig } from "../services/deliveryConfigService";

const router = express.Router();

// Calculate delivery fee based on distance
router.post("/calculate-delivery", authenticateToken, async (req, res) => {
  try {
    const { businessLat, businessLng, deliveryLat, deliveryLng } = req.body;
    
    if (!businessLat || !businessLng || !deliveryLat || !deliveryLng) {
      return res.status(400).json({ error: "Missing coordinates" });
    }

    const distance = calculateDistance(businessLat, businessLng, deliveryLat, deliveryLng);
    const deliveryFee = calculateDeliveryFee(distance);
    const estimatedTime = estimateDeliveryTime(distance);

    res.json({
      success: true,
      distance: Math.round(distance * 100) / 100,
      deliveryFee,
      estimatedTime,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create order
router.post("/", authenticateToken, validateOrderFinancials, async (req, res) => {
  try {
    const { orders, businesses, addresses } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const { eq, desc } = await import("drizzle-orm");

    // Calculate dynamic delivery fee if coordinates provided
    let deliveryFee = req.body.deliveryFee;
    let estimatedDeliveryTime = req.body.estimatedDeliveryTime;

    if (req.body.deliveryAddressId && req.body.businessId) {
      const [business] = await db.select().from(businesses).where(eq(businesses.id, req.body.businessId)).limit(1);
      const [address] = await db.select().from(addresses).where(eq(addresses.id, req.body.deliveryAddressId)).limit(1);

      if (business && address && business.latitude && business.longitude && address.latitude && address.longitude) {
        const distance = calculateDistance(
          business.latitude,
          business.longitude,
          address.latitude,
          address.longitude
        );
        deliveryFee = calculateDeliveryFee(distance);
        estimatedDeliveryTime = estimateDeliveryTime(distance, business.prepTime || 20);
      }
    }

    const productosBase = req.body.productosBase ?? req.body.subtotal;
    const nemyCommission =
      typeof req.body.nemyCommission === "number" && req.body.nemyCommission > 0
        ? req.body.nemyCommission
        : Math.round(productosBase * 0.15);
    const couponDiscount = req.body.couponDiscount || 0;
    const calculatedTotal = productosBase + nemyCommission + deliveryFee - couponDiscount;

    const orderData = {
      userId: req.user!.id,
      businessId: req.body.businessId,
      businessName: req.body.businessName,
      businessImage: req.body.businessImage,
      items: req.body.items,
      status: req.body.status || "pending",
      subtotal: productosBase,
      productosBase,
      nemyCommission,
      deliveryFee,
      total: calculatedTotal,
      paymentMethod: req.body.paymentMethod,
      deliveryAddress: req.body.deliveryAddress,
      notes: req.body.notes,
      substitutionPreference: req.body.substitutionPreference,
      itemSubstitutionPreferences: req.body.itemSubstitutionPreferences,
      cashPaymentAmount: req.body.cashPaymentAmount,
      cashChangeAmount: req.body.cashChangeAmount,
      estimatedDeliveryTime,
    };

    await db.insert(orders).values(orderData);
    
    const createdOrder = await db
      .select()
      .from(orders)
      .where(eq(orders.userId, req.user!.id))
      .orderBy(desc(orders.createdAt))
      .limit(1);
    
    const orderId = createdOrder[0].id;
    res.json({ 
      success: true, 
      id: orderId, 
      orderId, 
      order: { id: orderId },
      deliveryFee,
      estimatedDeliveryTime,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get user orders
router.get("/", authenticateToken, async (req, res) => {
  try {
    const { orders } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const { eq } = await import("drizzle-orm");

    const userOrders = await db
      .select()
      .from(orders)
      .where(eq(orders.userId, req.user!.id));
    
    res.json({ success: true, orders: userOrders });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get order by ID
router.get("/:id", authenticateToken, validateCustomerOrderOwnership, async (req, res) => {
  try {
    const { orders } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const { eq } = await import("drizzle-orm");
    const orderId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.json({ success: true, order });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Assign driver automatically
router.post("/:id/assign-driver", authenticateToken, async (req, res) => {
  try {
    const { orders, users } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const { eq, and } = await import("drizzle-orm");
    const orderId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const availableDrivers = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.role, "delivery_driver"),
          eq(users.isActive, true)
        )
      )
      .limit(10);

    if (availableDrivers.length === 0) {
      return res.json({ success: false, message: "No hay repartidores disponibles" });
    }

    const driver = availableDrivers[0];

    await db
      .update(orders)
      .set({
        deliveryPersonId: driver.id,
        status: "picked_up",
      })
      .where(eq(orders.id, orderId));

    res.json({
      success: true,
      driver: {
        id: driver.id,
        name: driver.name,
        phone: driver.phone,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Cancel order during regret period
router.post("/:id/cancel-regret", authenticateToken, validateCustomerOrderOwnership, async (req, res) => {
  try {
    const { orders } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const { eq } = await import("drizzle-orm");
    const orderId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (order.status !== "pending") {
      return res.status(400).json({ error: "Solo se pueden cancelar pedidos pendientes" });
    }

    await db.update(orders).set({ status: "cancelled" }).where(eq(orders.id, orderId));

    res.json({ success: true, message: "Pedido cancelado" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Confirm order after regret period
router.post("/:id/confirm", authenticateToken, validateCustomerOrderOwnership, async (req, res) => {
  try {
    const { orders } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const { eq } = await import("drizzle-orm");
    const orderId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    await db.update(orders).set({ status: "confirmed" }).where(eq(orders.id, orderId));

    res.json({ success: true, message: "Pedido confirmado" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Complete delivery and release funds
router.post(
  "/:id/complete-delivery",
  authenticateToken,
  requireRole("delivery_driver"),
  validateDriverOrderOwnership,
  async (req, res) => {
    try {
      const { orders } = await import("@shared/schema-mysql");
      const { db } = await import("../db");
      const { eq } = await import("drizzle-orm");
      const { calculateDistance } = await import("../utils/distance");
      const orderId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

      const [order] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, orderId))
        .limit(1);

      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }

      // Enforce proximity check (100m) before allowing delivery completion
      const driverLat = req.body.latitude ?? req.body.lat;
      const driverLng = req.body.longitude ?? req.body.lng;
      const hasDriverCoords =
        typeof driverLat === "number" && typeof driverLng === "number";

      if (!hasDriverCoords) {
        return res.status(400).json({ error: "Ubicación requerida para marcar entregado" });
      }

      const deliveryLat = order.deliveryLatitude ?? order.deliveryLat ?? order.latitude;
      const deliveryLng = order.deliveryLongitude ?? order.deliveryLng ?? order.longitude;
      const hasDeliveryCoords =
        typeof deliveryLat === "number" && typeof deliveryLng === "number";

      if (!hasDeliveryCoords) {
        return res.status(400).json({ error: "Pedido sin coordenadas de entrega" });
      }

      const distanceKm = calculateDistance(
        Number(driverLat),
        Number(driverLng),
        Number(deliveryLat),
        Number(deliveryLng),
      );

      const maxDistanceMeters = 100;
      if (distanceKm * 1000 > maxDistanceMeters) {
        return res.status(400).json({
          error: "Debes estar cerca del destino para marcar entregado",
          distanceMeters: Math.round(distanceKm * 1000),
        });
      }

      // Mark as delivered (waiting for customer confirmation)
      await db
        .update(orders)
        .set({ 
          status: "delivered", 
          deliveredAt: new Date(),
          driverArrivedAt: new Date() 
        })
        .where(eq(orders.id, orderId));

      res.json({
        success: true,
        message: "Pedido marcado como entregado. Esperando confirmación del cliente.",
      });
    } catch (error: any) {
      console.error("Complete delivery error:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

// Customer confirms receipt and releases funds
router.post(
  "/:id/confirm-receipt",
  authenticateToken,
  validateCustomerOrderOwnership,
  validateOrderCompletion,
  async (req, res) => {
    try {
      const { orders, wallets, transactions, businesses } = await import("@shared/schema-mysql");
      const { db } = await import("../db");
      const { eq } = await import("drizzle-orm");
      const orderId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

      const [order] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, orderId))
        .limit(1);

      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }

      if (order.status !== "delivered") {
        return res.status(400).json({ error: "El pedido debe estar entregado primero" });
      }

      if (order.confirmedByCustomer) {
        return res.status(400).json({ error: "Ya confirmaste este pedido" });
      }

      // Calculate commissions using centralized service
      const { financialService } = await import("../unifiedFinancialService");
      const commissions = await financialService.calculateCommissions(
        order.total,
        order.deliveryFee,
        order.productosBase || order.subtotal,
        order.nemyCommission || undefined
      );

      // Update order with commission breakdown and confirmation
      await db
        .update(orders)
        .set({
          confirmedByCustomer: true,
          confirmedByCustomerAt: new Date(),
          platformFee: commissions.platform,
          businessEarnings: commissions.business,
          deliveryEarnings: commissions.driver,
        })
        .where(eq(orders.id, orderId));

      const [business] = await db
        .select({ ownerId: businesses.ownerId })
        .from(businesses)
        .where(eq(businesses.id, order.businessId))
        .limit(1);

      const businessOwnerId = business?.ownerId || order.businessId;

      if (order.paymentMethod === "cash") {
        const { cashSettlementService } = await import("../cashSettlementService");
        await cashSettlementService.registerCashDebt(
          order.id,
          order.deliveryPersonId,
          order.businessId,
          order.total,
          order.deliveryFee,
        );
      } else {
        // Update business wallet (card only)
        const [businessWallet] = await db
          .select()
          .from(wallets)
          .where(eq(wallets.userId, businessOwnerId))
          .limit(1);

        if (businessWallet) {
          await db
            .update(wallets)
            .set({ 
              balance: businessWallet.balance + commissions.business,
              totalEarned: businessWallet.totalEarned + commissions.business,
            })
            .where(eq(wallets.userId, businessOwnerId));
        } else {
          await db.insert(wallets).values({
            userId: businessOwnerId,
            balance: commissions.business,
            pendingBalance: 0,
            totalEarned: commissions.business,
            totalWithdrawn: 0,
          });
        }

        // Update driver wallet (card only)
        const [driverWallet] = await db
          .select()
          .from(wallets)
          .where(eq(wallets.userId, order.deliveryPersonId))
          .limit(1);

        if (driverWallet) {
          await db
            .update(wallets)
            .set({ 
              balance: driverWallet.balance + commissions.driver,
              totalEarned: driverWallet.totalEarned + commissions.driver,
            })
            .where(eq(wallets.userId, order.deliveryPersonId));
        } else {
          await db.insert(wallets).values({
            userId: order.deliveryPersonId,
            balance: commissions.driver,
            pendingBalance: 0,
            totalEarned: commissions.driver,
            totalWithdrawn: 0,
          });
        }

        // Create transaction records (card only)
        await db.insert(transactions).values([
          {
            userId: businessOwnerId,
            type: "order_payment",
            amount: commissions.business,
            status: "completed",
            description: `Pago por pedido #${order.id.slice(-8)}`,
            orderId: order.id,
          },
          {
            userId: order.deliveryPersonId,
            type: "delivery_payment",
            amount: commissions.driver,
            status: "completed",
            description: `Entrega de pedido #${order.id.slice(-8)}`,
            orderId: order.id,
          },
        ]);
      }

      res.json({
        success: true,
        message: "Pedido confirmado y fondos liberados",
        distribution: {
          platform: commissions.platform / 100,
          business: commissions.business / 100,
          driver: commissions.driver / 100,
        },
      });
    } catch (error: any) {
      console.error("Confirm receipt error:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

// NEW: Driver picks up order from business
router.post(
  "/:id/pickup",
  authenticateToken,
  requireRole("delivery_driver"),
  validateDriverOrderOwnership,
  async (req, res) => {
    try {
      const { orders } = await import("@shared/schema-mysql");
      const { db } = await import("../db");
      const { eq } = await import("drizzle-orm");
      const orderId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

      const [order] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, orderId))
        .limit(1);

      if (!order) {
        return res.status(404).json({ error: "Pedido no encontrado" });
      }

      // Validar que el pedido está en preparing
      if (order.status !== "preparing") {
        return res.status(400).json({ 
          error: `No puedes recoger este pedido. Estado actual: ${order.status}` 
        });
      }

      // Validar que el repartidor está asignado a este pedido
      if (order.deliveryPersonId !== req.user!.id) {
        return res.status(403).json({ error: "Este pedido no está asignado a ti" });
      }

      // Cambiar estado a on_the_way y registrar timestamp
      await db
        .update(orders)
        .set({ 
          status: "on_the_way",
          driverPickedUpAt: new Date()
        })
        .where(eq(orders.id, orderId));

      res.json({
        success: true,
        message: "Pedido recogido. Ahora en camino al cliente.",
        order: {
          id: order.id,
          status: "on_the_way",
          driverPickedUpAt: new Date()
        }
      });
    } catch (error: any) {
      console.error("Pickup order error:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

export default router;
