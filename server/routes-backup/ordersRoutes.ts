import express from "express";
import { authenticateToken, requireRole } from "../authMiddleware";
import { validateOrderFinancials, validateOrderCompletion } from "../financialMiddleware";
import { validateCustomerOrderOwnership, validateDriverOrderOwnership } from "../validateOwnership";
import { eq, desc, inArray } from "drizzle-orm";

const router = express.Router();

// Get user orders
router.get("/", authenticateToken, async (req, res) => {
  try {
    const { FinanceService } = await import("../financeService");
    const userOrders = await FinanceService.getUserOrders(req.user!.id);
    
    res.json({ success: true, orders: userOrders });
  } catch (error: any) {
    console.error('Get orders error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create order
router.post("/", authenticateToken, validateOrderFinancials, async (req, res) => {
  try {
    const { orders } = await import("@shared/schema-mysql");
    const { db } = await import("../db");

    const productosBase = req.body.productosBase ?? req.body.subtotal;
    const nemyCommission =
      typeof req.body.nemyCommission === "number" && req.body.nemyCommission > 0
        ? req.body.nemyCommission
        : Math.round(productosBase * 0.15);
    const couponDiscount = req.body.couponDiscount || 0;
    const calculatedTotal = productosBase + nemyCommission + req.body.deliveryFee - couponDiscount;

    const orderData = {
      userId: req.user!.id,
      businessId: req.body.businessId,
      businessName: req.body.businessName,
      businessImage: req.body.businessImage,
      items: req.body.items,
      status: "pending",
      subtotal: productosBase,
      productosBase,
      nemyCommission,
      deliveryFee: req.body.deliveryFee,
      total: calculatedTotal,
      paymentMethod: req.body.paymentMethod,
      deliveryAddress: req.body.deliveryAddress,
      deliveryLatitude: req.body.deliveryLatitude,
      deliveryLongitude: req.body.deliveryLongitude,
      notes: req.body.notes,
      substitutionPreference: req.body.substitutionPreference,
      itemSubstitutionPreferences: req.body.itemSubstitutionPreferences,
      cashPaymentAmount: req.body.cashPaymentAmount,
      cashChangeAmount: req.body.cashChangeAmount,
    };

    await db.insert(orders).values(orderData);
    
    const createdOrder = await db
      .select()
      .from(orders)
      .where(eq(orders.userId, req.user!.id))
      .orderBy(desc(orders.createdAt))
      .limit(1);
    
    const orderId = createdOrder[0].id;
    console.log('✅ Order created with ID:', orderId);

    if (req.body.deliveryLatitude && req.body.deliveryLongitude) {
      const { calculateDynamicETA } = await import("../dynamicETAService");
      const eta = await calculateDynamicETA(
        req.body.businessId,
        parseFloat(req.body.deliveryLatitude),
        parseFloat(req.body.deliveryLongitude)
      );

      await db
        .update(orders)
        .set({
          estimatedPrepTime: eta.prepTime,
          estimatedDeliveryTime: eta.deliveryTime,
          estimatedTotalTime: eta.totalTime,
          estimatedDelivery: eta.estimatedArrival,
        })
        .where(eq(orders.id, orderId));

      console.log(`⏱️ ETA calculated: ${eta.totalTime} min`);
    }

    res.json({ success: true, id: orderId, orderId, order: { id: orderId } });
  } catch (error: any) {
    console.error('Create order error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get order by ID
router.get("/:id", authenticateToken, validateCustomerOrderOwnership, async (req, res) => {
  try {
    const { orders } = await import("@shared/schema-mysql");
    const { db } = await import("../db");

    const order = await db
      .select()
      .from(orders)
      .where(eq(orders.id, req.params.id))
      .limit(1);

    if (!order[0]) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.json({ success: true, order: order[0] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Cancel order during regret period
router.post("/:id/cancel-regret", authenticateToken, validateCustomerOrderOwnership, async (req, res) => {
  try {
    const { orders } = await import("@shared/schema-mysql");
    const { db } = await import("../db");

    const [order] = await db.select().from(orders).where(eq(orders.id, req.params.id)).limit(1);

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (order.status !== "pending") {
      return res.status(400).json({ error: "Solo se pueden cancelar pedidos pendientes" });
    }

    await db.update(orders).set({ status: "cancelled" }).where(eq(orders.id, req.params.id));

    res.json({ success: true, message: "Pedido cancelado" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Confirm order
router.post("/:id/confirm", authenticateToken, async (req, res) => {
  try {
    res.json({ success: true, message: "Order confirmed to business" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Order chat - GET
router.get("/:id/chat", authenticateToken, async (req, res) => {
  try {
    const { ensureOrderAccess } = await import("../utils/orderUtils");
    const { getChatMessages } = await import("../chatService");

    const access = await ensureOrderAccess(
      req.params.id,
      req.user!.id,
      req.user!.role,
    );

    if ("status" in access) {
      return res.status(access.status).json({ error: access.error });
    }

    const messages = getChatMessages(req.params.id).map((msg) => ({
      id: msg.id,
      orderId: msg.orderId,
      senderId: msg.senderId,
      receiverId: msg.receiverId,
      message: msg.message,
      createdAt: msg.timestamp,
      isRead: false,
    }));

    return res.json(messages);
  } catch (error: any) {
    console.error("Error fetching order chat:", error);
    return res.status(500).json({ error: error.message });
  }
});

// Order chat - POST
router.post("/:id/chat", authenticateToken, async (req, res) => {
  try {
    const { ensureOrderAccess } = await import("../utils/orderUtils");
    const { addChatMessage } = await import("../chatService");

    const access = await ensureOrderAccess(
      req.params.id,
      req.user!.id,
      req.user!.role,
    );

    if ("status" in access) {
      return res.status(access.status).json({ error: access.error });
    }

    const { message, receiverId } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Message is required" });
    }

    if (!receiverId) {
      return res.status(400).json({ error: "receiverId is required" });
    }

    const chatMessage = addChatMessage(
      req.params.id,
      req.user!.id,
      receiverId,
      message,
      req.user!.name || "Usuario",
    );

    return res.json({
      success: true,
      message: {
        id: chatMessage.id,
        orderId: chatMessage.orderId,
        senderId: chatMessage.senderId,
        receiverId: chatMessage.receiverId,
        message: chatMessage.message,
        createdAt: chatMessage.timestamp,
        isRead: false,
      },
    });
  } catch (error: any) {
    console.error("Error sending order chat message:", error);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
