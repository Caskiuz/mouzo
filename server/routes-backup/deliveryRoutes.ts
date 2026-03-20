import express from "express";
import { authenticateToken, requireRole } from "../authMiddleware";
import { validateDriverOrderOwnership } from "../validateOwnership";
import { eq, and, desc } from "drizzle-orm";

const router = express.Router();

// Get driver status
router.get("/status", authenticateToken, async (req, res) => {
  try {
    const { users } = await import("@shared/schema-mysql");
    const { db } = await import("../db");

    console.log(`🔍 GET /delivery/status - User ID: ${req.user!.id}, Role: ${req.user!.role}`);

    const driver = await db
      .select({
        id: users.id,
        isOnline: users.isOnline,
        isActive: users.isActive,
        role: users.role
      })
      .from(users)
      .where(eq(users.id, req.user!.id))
      .limit(1);

    if (!driver[0]) {
      console.error(`❌ Driver not found: ${req.user!.id}`);
      return res.status(404).json({ error: "Driver not found" });
    }

    const isOnline = Boolean(driver[0].isOnline);
    
    console.log(`✅ Driver ${req.user!.id} status: isOnline=${driver[0].isOnline} -> ${isOnline}`);

    res.json({
      success: true,
      isOnline: isOnline,
      strikes: 0,
    });
  } catch (error: any) {
    console.error('Get status error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Toggle driver online/offline status
router.post("/toggle-status", authenticateToken, async (req, res) => {
  try {
    const { users } = await import("@shared/schema-mysql");
    const { db } = await import("../db");

    console.log(`🚗 POST /delivery/toggle-status - User ID: ${req.user!.id}, Role: ${req.user!.role}`);

    const driver = await db
      .select({
        id: users.id,
        isOnline: users.isOnline,
        role: users.role
      })
      .from(users)
      .where(eq(users.id, req.user!.id))
      .limit(1);

    if (!driver[0]) {
      console.error(`❌ Driver not found: ${req.user!.id}`);
      return res.status(404).json({ error: "Driver not found" });
    }

    const currentStatus = Boolean(driver[0].isOnline);
    const newStatus = !currentStatus;
    
    console.log(`🚗 Driver ${req.user!.id} toggling: ${currentStatus} -> ${newStatus}`);

    await db
      .update(users)
      .set({ 
        isOnline: newStatus,
        lastActiveAt: new Date()
      })
      .where(eq(users.id, req.user!.id));

    const [updatedDriver] = await db
      .select({ isOnline: users.isOnline })
      .from(users)
      .where(eq(users.id, req.user!.id))
      .limit(1);

    console.log(`✅ Driver ${req.user!.id} status updated to: ${newStatus}, verified: ${updatedDriver?.isOnline}`);

    res.json({
      success: true,
      isOnline: Boolean(updatedDriver?.isOnline),
      message: newStatus ? "Ahora estás en línea" : "Ahora estás desconectado",
    });
  } catch (error: any) {
    console.error('Toggle status error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get available orders for drivers
router.get("/available-orders", authenticateToken, requireRole("delivery_driver"), async (req, res) => {
  try {
    const { getAvailableOrdersForDriver } = await import("../zoneFiltering");
    const result = await getAvailableOrdersForDriver(req.user!.id);
    res.json(result);
  } catch (error: any) {
    console.error("Error fetching available orders:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to get available orders",
      orders: []
    });
  }
});

// Accept order
router.post("/accept-order/:id", authenticateToken, async (req, res) => {
  try {
    const { orders } = await import("@shared/schema-mysql");
    const { db } = await import("../db");

    console.log(`✅ POST /delivery/accept-order/${req.params.id} - Driver: ${req.user!.id}`);

    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, req.params.id))
      .limit(1);

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (order.deliveryPersonId) {
      return res.status(400).json({ error: "Order already assigned" });
    }

    // Cash security validation
    if (order.paymentMethod === 'cash') {
      const { cashSecurityService } = await import('../cashSecurityService');
      const canAccept = await cashSecurityService.canAcceptCashOrder(req.user!.id);
      
      if (!canAccept.allowed) {
        return res.status(403).json({ 
          error: canAccept.reason,
          code: 'CASH_LIMIT_EXCEEDED',
          action: 'LIQUIDATE_CASH'
        });
      }
    }

    await db
      .update(orders)
      .set({
        deliveryPersonId: req.user!.id,
        status: "picked_up",
        assignedAt: new Date()
      })
      .where(eq(orders.id, req.params.id));

    console.log(`✅ Order ${req.params.id} accepted by driver ${req.user!.id}`);

    res.json({ success: true, message: "Order accepted" });
  } catch (error: any) {
    console.error('Accept order error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get driver orders
router.get("/my-orders", authenticateToken, requireRole("delivery_driver"), async (req, res) => {
  try {
    const { orders } = await import("@shared/schema-mysql");
    const { db } = await import("../db");

    const driverOrders = await db
      .select()
      .from(orders)
      .where(eq(orders.deliveryPersonId, req.user!.id))
      .orderBy(desc(orders.createdAt));

    res.json({ success: true, orders: driverOrders });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update order status (Driver)
router.put("/orders/:id/status", authenticateToken, requireRole("delivery_driver"), validateDriverOrderOwnership, async (req, res) => {
  try {
    const { orders } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const { validateStateTransition, validateRoleCanChangeToState } = await import("../orderStateValidation");
    const { status } = req.body;

    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, req.params.id))
      .limit(1);

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Validate role permissions
    const roleValidation = validateRoleCanChangeToState("delivery_driver", status);
    if (!roleValidation.valid) {
      return res.status(403).json({ error: roleValidation.error });
    }

    // Validate state transition
    const transitionValidation = validateStateTransition(order.status, status);
    if (!transitionValidation.valid) {
      return res.status(400).json({ error: transitionValidation.error });
    }

    await db
      .update(orders)
      .set({ 
        status, 
        updatedAt: new Date(),
        ...(status === "delivered" && { deliveredAt: new Date() })
      })
      .where(eq(orders.id, req.params.id));

    // Handle delivery completion
    if (status === "delivered") {
      try {
        console.log(`💰 Processing delivery completion for order ${req.params.id}`);
        
        if (order.paymentMethod === "cash") {
          const { cashSettlementService } = await import("../cashSettlementService");
          await cashSettlementService.registerCashDebt(
            order.id,
            req.user!.id,
            order.businessId,
            order.total,
            order.deliveryFee
          );
          
          console.log(`💵 Cash order completed - debt registered for driver ${req.user!.id}`);
        } else {
          // Handle card payment distribution
          const { financialService } = await import("../unifiedFinancialService");
          const commissions = await financialService.calculateCommissions(
            order.total || 0,
            order.deliveryFee || 0,
            order.productosBase || order.subtotal,
            order.nemyCommission || undefined
          );

          console.log(`💳 Card payment - distributing commissions`);

          // Update order with commission breakdown
          await db
            .update(orders)
            .set({
              platformFee: commissions.mouzo,
              businessEarnings: commissions.business,
              deliveryEarnings: commissions.driver,
            })
            .where(eq(orders.id, req.params.id));

          // Distribute to wallets
          const { wallets, transactions } = await import("@shared/schema-mysql");
          
          // Update business wallet
          const [businessWallet] = await db
            .select()
            .from(wallets)
            .where(eq(wallets.userId, order.businessId))
            .limit(1);

          if (businessWallet) {
            await db
              .update(wallets)
              .set({ 
                balance: businessWallet.balance + commissions.business,
                totalEarned: businessWallet.totalEarned + commissions.business,
                updatedAt: new Date(),
              })
              .where(eq(wallets.userId, order.businessId));
          } else {
            await db.insert(wallets).values({
              userId: order.businessId,
              balance: commissions.business,
              pendingBalance: 0,
              totalEarned: commissions.business,
              totalWithdrawn: 0,
              cashOwed: 0,
            });
          }

          // Update driver wallet
          const [driverWallet] = await db
            .select()
            .from(wallets)
            .where(eq(wallets.userId, req.user!.id))
            .limit(1);

          if (driverWallet) {
            await db
              .update(wallets)
              .set({ 
                balance: driverWallet.balance + commissions.driver,
                totalEarned: driverWallet.totalEarned + commissions.driver,
                updatedAt: new Date(),
              })
              .where(eq(wallets.userId, req.user!.id));
          } else {
            await db.insert(wallets).values({
              userId: req.user!.id,
              balance: commissions.driver,
              pendingBalance: 0,
              totalEarned: commissions.driver,
              totalWithdrawn: 0,
              cashOwed: 0,
            });
          }

          // Create transactions
          await db.insert(transactions).values([
            {
              userId: order.businessId,
              orderId: order.id,
              type: "order_payment",
              amount: commissions.business,
              status: "completed",
              description: `Pago por pedido #${order.id.slice(-8)}`,
              createdAt: new Date(),
            },
            {
              userId: req.user!.id,
              orderId: order.id,
              type: "delivery_payment",
              amount: commissions.driver,
              status: "completed",
              description: `Entrega de pedido #${order.id.slice(-8)}`,
              createdAt: new Date(),
            }
          ]);
        }

        console.log(`✅ Order ${req.params.id} delivery completed successfully`);
      } catch (transferError) {
        console.error('❌ Error processing delivery completion:', transferError);
      }
    }

    res.json({ success: true, message: "Status updated" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get driver earnings
router.get("/earnings", authenticateToken, requireRole("delivery_driver"), async (req, res) => {
  try {
    const { orders } = await import("@shared/schema-mysql");
    const { db } = await import("../db");

    const completedOrders = await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.deliveryPersonId, req.user!.id),
          eq(orders.status, "delivered")
        )
      );

    const totalEarnings = completedOrders.reduce(
      (sum, order) => sum + (order.total * 0.15),
      0
    );

    const todayEarnings = completedOrders
      .filter(order => {
        const today = new Date();
        const orderDate = new Date(order.createdAt);
        return orderDate.toDateString() === today.toDateString();
      })
      .reduce((sum, order) => sum + (order.total * 0.15), 0);

    res.json({
      success: true,
      earnings: {
        total: Math.round(totalEarnings),
        today: Math.round(todayEarnings),
        orders: completedOrders.length,
        todayOrders: completedOrders.filter(order => {
          const today = new Date();
          const orderDate = new Date(order.createdAt);
          return orderDate.toDateString() === today.toDateString();
        }).length,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;