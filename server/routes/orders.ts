import express from "express";
import { authenticateToken, requireRole } from "../authMiddleware";
import { eq, and, desc, inArray } from "drizzle-orm";

const router = express.Router();

// Get user orders
router.get("/", authenticateToken, async (req, res) => {
  try {
    const { orders, businesses } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    
    const userOrders = await db
      .select({
        order: orders,
        business: {
          id: businesses.id,
          name: businesses.name,
          image: businesses.image,
        }
      })
      .from(orders)
      .leftJoin(businesses, eq(orders.businessId, businesses.id))
      .where(eq(orders.userId, req.user!.id))
      .orderBy(desc(orders.createdAt));

    res.json({ success: true, orders: userOrders });
  } catch (error: any) {
    console.error("Get orders error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get order by ID
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const { orders, businesses, products } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    
    const [order] = await db
      .select({
        order: orders,
        business: {
          id: businesses.id,
          name: businesses.name,
          image: businesses.image,
          phone: businesses.phone,
          address: businesses.address,
        }
      })
      .from(orders)
      .leftJoin(businesses, eq(orders.businessId, businesses.id))
      .where(eq(orders.id, req.params.id))
      .limit(1);

    if (!order) {
      return res.status(404).json({ error: "Pedido no encontrado" });
    }

    // Verify ownership
    if (order.order.userId !== req.user!.id && 
        req.user!.role !== "admin" && 
        req.user!.role !== "delivery_driver") {
      return res.status(403).json({ error: "No autorizado" });
    }

    res.json({ 
      success: true, 
      order: {
        ...order.order,
        business: order.business,
      }
    });
  } catch (error: any) {
    console.error("Get order error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Create order
router.post("/", authenticateToken, async (req, res) => {
  try {
    const { orders, businesses, products } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    
    const {
      businessId, businessName, businessImage,
      items: rawItems, deliveryAddress, deliveryAddressId,
      deliveryLatitude, deliveryLongitude,
      paymentMethod, notes,
      subtotal: clientSubtotal, productosBase, nemyCommission,
      deliveryFee: clientDeliveryFee, total: clientTotal,
      substitutionPreference, itemSubstitutionPreferences,
      cashPaymentAmount, cashChangeAmount,
      couponCode, couponDiscount,
    } = req.body;

    // items puede llegar como array o como string JSON
    const items: any[] = Array.isArray(rawItems)
      ? rawItems
      : (typeof rawItems === "string" ? JSON.parse(rawItems) : []);

    if (!businessId || !items || items.length === 0) {
      return res.status(400).json({ error: "Datos del pedido incompletos" });
    }

    // Verify business exists and is active
    const [business] = await db
      .select()
      .from(businesses)
      .where(and(
        eq(businesses.id, businessId),
        eq(businesses.isActive, true)
      ))
      .limit(1);

    if (!business) {
      return res.status(404).json({ error: "Negocio no encontrado" });
    }

    // Verify products exist and calculate total
    const productIds = items.map((item: any) => item.productId);
    const orderProducts = await db
      .select()
      .from(products)
      .where(inArray(products.id, productIds));

    let subtotal = 0;
    const validItems = [];

    for (const item of items) {
      const product = orderProducts.find(p => p.id === item.productId);
      if (!product || !product.isAvailable) {
        return res.status(400).json({ 
          error: `Producto no disponible: ${item.productId}` 
        });
      }

      const itemTotal = product.price * item.quantity;
      subtotal += itemTotal;
      
      validItems.push({
        productId: item.productId,
        quantity: item.quantity,
        price: product.price,
        total: itemTotal,
        notes: item.notes || null,
      });
    }

    const deliveryFee = clientDeliveryFee ?? business.deliveryFee ?? 2500;
    const finalSubtotal = clientSubtotal ?? subtotal;
    const total = clientTotal ?? (finalSubtotal + deliveryFee);

    // Create order
    const orderId = crypto.randomUUID();
    const newOrder = {
      id: orderId,
      userId: req.user!.id,
      businessId,
      businessName: businessName || business.name,
      businessImage: businessImage || business.image || "",
      items: JSON.stringify(validItems),
      status: "pending" as const,
      subtotal: finalSubtotal,
      productosBase: productosBase ?? finalSubtotal,
      nemyCommission: nemyCommission ?? Math.round(finalSubtotal * 0.15),
      deliveryFee,
      total,
      paymentMethod: paymentMethod || "cash",
      deliveryAddress: deliveryAddress || "",
      deliveryLatitude: deliveryLatitude || null,
      deliveryLongitude: deliveryLongitude || null,
      notes: notes || null,
      substitutionPreference: substitutionPreference || "refund",
      itemSubstitutionPreferences: itemSubstitutionPreferences || null,
      cashPaymentAmount: cashPaymentAmount || null,
      cashChangeAmount: cashChangeAmount || null,
      createdAt: new Date(),
    };

    await db.insert(orders).values(newOrder);

    res.json({ 
      success: true,
      orderId,
      order: newOrder
    });
  } catch (error: any) {
    console.error("Create order error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Confirm order after regret period (notify business)
router.post("/:id/confirm", authenticateToken, async (req, res) => {
  try {
    const { orders } = await import("@shared/schema-mysql");
    const { db } = await import("../db");

    const [order] = await db.select().from(orders).where(eq(orders.id, req.params.id)).limit(1);
    if (!order) return res.status(404).json({ error: "Pedido no encontrado" });
    if (order.userId !== req.user!.id && req.user!.role !== "admin")
      return res.status(403).json({ error: "No autorizado" });

    await db.update(orders).set({
      status: "accepted",
      confirmedToBusinessAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(orders.id, req.params.id));

    res.json({ success: true, message: "Pedido confirmado" });
  } catch (error: any) {
    console.error("Confirm order error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Cancel during regret period (no penalty)
router.post("/:id/cancel-regret", authenticateToken, async (req, res) => {
  try {
    const { orders } = await import("@shared/schema-mysql");
    const { db } = await import("../db");

    const [order] = await db.select().from(orders).where(eq(orders.id, req.params.id)).limit(1);
    if (!order) return res.status(404).json({ error: "Pedido no encontrado" });
    if (order.userId !== req.user!.id && req.user!.role !== "admin")
      return res.status(403).json({ error: "No autorizado" });
    if (order.status !== "pending")
      return res.status(400).json({ error: "Solo se puede cancelar un pedido pendiente" });

    await db.update(orders).set({
      status: "cancelled" as any,
      cancelledAt: new Date(),
      cancelledBy: req.user!.id,
      cancellationReason: "regret_period",
      updatedAt: new Date(),
    }).where(eq(orders.id, req.params.id));

    res.json({ success: true, message: "Pedido cancelado sin penalización" });
  } catch (error: any) {
    console.error("Cancel regret error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Update order status (business owner or admin)
router.patch("/:id/status", authenticateToken, async (req, res) => {
  try {
    const { orders, businesses } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({ error: "Estado requerido" });
    }

    const validStatuses = [
      "pending", "accepted", "preparing", "ready",
      "assigned_driver", "picked_up", "on_the_way",
      "in_transit", "arriving", "delivered", "cancelled", "refunded"
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Estado inválido" });
    }

    const [order] = await db
      .select({
        order: orders,
        business: businesses
      })
      .from(orders)
      .leftJoin(businesses, eq(orders.businessId, businesses.id))
      .where(eq(orders.id, req.params.id))
      .limit(1);

    if (!order) {
      return res.status(404).json({ error: "Pedido no encontrado" });
    }

    // Check permissions
    const canUpdate = 
      req.user!.role === "admin" ||
      (req.user!.role === "business_owner" && order.business?.ownerId === req.user!.id) ||
      (req.user!.role === "delivery_driver" && ["picked_up", "on_the_way", "in_transit", "arriving", "delivered"].includes(status));

    if (!canUpdate) {
      return res.status(403).json({ error: "No autorizado" });
    }

    await db
      .update(orders)
      .set({ 
        status,
        updatedAt: new Date()
      })
      .where(eq(orders.id, req.params.id));

    res.json({ success: true, message: "Estado actualizado" });
  } catch (error: any) {
    console.error("Update order status error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Cancel order
router.patch("/:id/cancel", authenticateToken, async (req, res) => {
  try {
    const { orders } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, req.params.id))
      .limit(1);

    if (!order) {
      return res.status(404).json({ error: "Pedido no encontrado" });
    }

    // Check permissions
    const canCancel = 
      order.userId === req.user!.id ||
      req.user!.role === "admin";

    if (!canCancel) {
      return res.status(403).json({ error: "No autorizado" });
    }

    // Check if order can be cancelled
    if (!["pending", "confirmed"].includes(order.status)) {
      return res.status(400).json({ 
        error: "El pedido no puede ser cancelado en su estado actual" 
      });
    }

    await db
      .update(orders)
      .set({ 
        status: "cancelled",
        updatedAt: new Date()
      })
      .where(eq(orders.id, req.params.id));

    res.json({ success: true, message: "Pedido cancelado" });
  } catch (error: any) {
    console.error("Cancel order error:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;