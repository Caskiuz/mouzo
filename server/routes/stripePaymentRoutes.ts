import express from "express";
import { authenticateToken } from "../authMiddleware";
import { db } from "../db";
import { users } from "@shared/schema-mysql";
import { eq } from "drizzle-orm";
import { getStripe } from "../stripeClient";

const router = express.Router();

// Publishable key for Stripe SDK (public endpoint)
router.get("/publishable-key", async (_req, res) => {
  try {
    if (!process.env.STRIPE_PUBLISHABLE_KEY) {
      return res.status(503).json({ error: "Stripe not configured" });
    }

    res.json({ publishableKey: process.env.STRIPE_PUBLISHABLE_KEY });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create PaymentIntent for checkout
router.post("/create-payment-intent", authenticateToken, async (req, res) => {
  try {
    if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_PUBLISHABLE_KEY) {
      console.error("Stripe config missing", {
        hasSecret: !!process.env.STRIPE_SECRET_KEY,
        hasPublishable: !!process.env.STRIPE_PUBLISHABLE_KEY,
      });
      return res.status(503).json({ message: "Stripe no está configurado" });
    }

    const { amount, businessId, orderId, subtotal, deliveryFee } = req.body;
    if (!amount || amount <= 0 || !businessId || !orderId) {
      console.error("Invalid payment intent data", {
        amount,
        businessId,
        orderId,
        userId: req.user?.id,
      });
      return res.status(400).json({ message: "Datos de pago incompletos" });
    }

    // Get business Stripe Connect account
    const { businesses } = await import("@shared/schema-mysql");
    const [business] = await db
      .select()
      .from(businesses)
      .where(eq(businesses.id, businessId))
      .limit(1);

    if (!business) {
      return res.status(404).json({ message: "Negocio no encontrado" });
    }

    if (!business.stripeAccountId) {
      return res.status(400).json({ 
        message: "El negocio no ha configurado su cuenta de pagos" 
      });
    }

    const stripe = getStripe();
    const amountInCents = Math.round(amount);
    const subtotalInCents = Math.round(subtotal || 0);
    
    // Calculate MOUZO commission (15% of subtotal)
    const mouzoCommission = Math.round(subtotalInCents * 0.15);

    // Create PaymentIntent WITHOUT transfer_data
    // Money stays in platform account until customer confirms delivery
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: "mxn",
      // NO transfer_data - funds retained by platform
      // NO application_fee - we'll transfer manually after confirmation
      metadata: {
        userId: req.user!.id,
        businessId,
        orderId,
        subtotal: subtotalInCents.toString(),
        deliveryFee: (deliveryFee || 0).toString(),
        mouzoCommission: mouzoCommission.toString(),
      },
    });

    // Update order with payment details
    const { orders } = await import("@shared/schema-mysql");
    await db
      .update(orders)
      .set({
        paymentIntentId: paymentIntent.id,
        stripePaymentIntentId: paymentIntent.id,
        productosBase: subtotalInCents,
        mouzoCommission,
        platformFee: mouzoCommission,
        businessEarnings: subtotalInCents, // Business gets 100% of products
        deliveryEarnings: deliveryFee || 0, // Delivery gets 100% of delivery fee
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId));

    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (error: any) {
    console.error("Create payment intent error", {
      userId: req.user?.id,
      amount: req.body?.amount,
      code: error?.code,
      type: error?.type,
      message: error?.message,
    });
    res.status(500).json({ message: "No se pudo crear el pago", error: error?.message });
  }
});

// Get saved payment method
router.get("/payment-method/:userId", authenticateToken, async (req, res) => {
  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.params.userId))
      .limit(1);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Drivers don't need payment methods (they receive money)
    if (user.role === "delivery_driver") {
      return res.json({ hasCard: false });
    }

    if (user.cardLast4 && user.cardBrand) {
      return res.json({
        hasCard: true,
        card: {
          last4: user.cardLast4,
          brand: user.cardBrand,
        },
      });
    }

    res.json({ hasCard: false });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create setup intent for adding card
router.post("/create-setup-intent", authenticateToken, async (req, res) => {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(503).json({ error: "Stripe not configured" });
    }

    const stripe = (await import("stripe")).default;
    const stripeClient = new stripe(process.env.STRIPE_SECRET_KEY);

    const { userId } = req.body;

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    let customerId = user.stripeCustomerId;

    if (!customerId) {
      const customer = await stripeClient.customers.create({
        metadata: { userId },
      });
      customerId = customer.id;

      await db
        .update(users)
        .set({ stripeCustomerId: customerId })
        .where(eq(users.id, userId));
    }

    const setupIntent = await stripeClient.setupIntents.create({
      customer: customerId,
      payment_method_types: ["card"],
    });

    res.json({ clientSecret: setupIntent.client_secret });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Save payment method
router.post("/save-payment-method", authenticateToken, async (req, res) => {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(503).json({ error: "Stripe not configured" });
    }

    const stripe = (await import("stripe")).default;
    const stripeClient = new stripe(process.env.STRIPE_SECRET_KEY);

    const { userId, paymentMethodId } = req.body;

    const paymentMethod = await stripeClient.paymentMethods.retrieve(paymentMethodId);

    await db
      .update(users)
      .set({
        stripePaymentMethodId: paymentMethodId,
        cardLast4: paymentMethod.card?.last4 || null,
        cardBrand: paymentMethod.card?.brand || null,
      })
      .where(eq(users.id, userId));

    res.json({
      success: true,
      card: {
        last4: paymentMethod.card?.last4,
        brand: paymentMethod.card?.brand,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete payment method
router.delete("/payment-method/:userId", authenticateToken, async (req, res) => {
  try {
    await db
      .update(users)
      .set({
        stripePaymentMethodId: null,
        cardLast4: null,
        cardBrand: null,
      })
      .where(eq(users.id, req.params.userId));

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Confirm delivery and release funds (customer confirms receipt)
router.post("/confirm-delivery/:orderId", authenticateToken, async (req, res) => {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(503).json({ error: "Stripe not configured" });
    }

    const stripe = (await import("stripe")).default;
    const stripeClient = new stripe(process.env.STRIPE_SECRET_KEY);
    const { orders, businesses, users: usersTable } = await import("@shared/schema-mysql");

    const [order] = await db.select().from(orders).where(eq(orders.id, req.params.orderId)).limit(1);
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (order.userId !== req.user!.id) return res.status(403).json({ error: "Not authorized" });
    if (order.status !== "delivered") return res.status(400).json({ error: "Order not delivered yet" });
    if (order.confirmedByCustomer) return res.status(400).json({ error: "Already confirmed" });
    if (!order.paymentIntentId) return res.status(400).json({ error: "No payment found" });

    // Get business and driver accounts
    const [business] = await db.select().from(businesses).where(eq(businesses.id, order.businessId)).limit(1);
    if (!business || !business.stripeAccountId) {
      return res.status(400).json({ error: "Business account not configured" });
    }

    let driverAccount = null;
    if (order.deliveryPersonId) {
      const [driver] = await db.select().from(usersTable).where(eq(usersTable.id, order.deliveryPersonId)).limit(1);
      driverAccount = driver?.stripeAccountId;
    }

    // Get the charge from PaymentIntent
    const paymentIntent = await stripeClient.paymentIntents.retrieve(order.paymentIntentId);
    const chargeId = paymentIntent.charges.data[0]?.id;
    if (!chargeId) return res.status(400).json({ error: "No charge found" });

    const businessAmount = order.businessEarnings || order.productosBase || 0;
    const deliveryAmount = order.deliveryEarnings || order.deliveryFee || 0;

    // Transfer 1: To business (100% products)
    const businessTransfer = await stripeClient.transfers.create({
      amount: businessAmount,
      currency: "mxn",
      destination: business.stripeAccountId,
      source_transaction: chargeId,
      metadata: { orderId: order.id, type: "business_payment" },
    });

    // Transfer 2: To driver (100% delivery fee) - only if driver exists
    let driverTransfer = null;
    if (driverAccount && deliveryAmount > 0) {
      driverTransfer = await stripeClient.transfers.create({
        amount: deliveryAmount,
        currency: "mxn",
        destination: driverAccount,
        source_transaction: chargeId,
        metadata: { orderId: order.id, type: "delivery_payment" },
      });
    }

    // Update order
    await db.update(orders).set({
      confirmedByCustomer: true,
      confirmedByCustomerAt: new Date(),
      fundsReleased: true,
      fundsReleasedAt: new Date(),
      businessTransferId: businessTransfer.id,
      driverTransferId: driverTransfer?.id || null,
      driverPaymentStatus: driverTransfer ? "completed" : "pending",
      driverPaidAt: driverTransfer ? new Date() : null,
      updatedAt: new Date(),
    }).where(eq(orders.id, order.id));

    // Create wallet transactions
    const { transactions, wallets } = await import("@shared/schema-mysql");

    // Business transaction
    const [businessOwner] = await db.select().from(businesses).where(eq(businesses.id, order.businessId)).limit(1);
    if (businessOwner?.ownerId) {
      const [businessWallet] = await db.select().from(wallets).where(eq(wallets.userId, businessOwner.ownerId)).limit(1);
      if (businessWallet) {
        await db.insert(transactions).values({
          walletId: businessWallet.id,
          orderId: order.id,
          businessId: business.id,
          userId: businessOwner.ownerId,
          type: "income",
          amount: businessAmount,
          balanceBefore: businessWallet.balance,
          balanceAfter: businessWallet.balance + businessAmount,
          description: `Payment for order ${order.id}`,
          status: "completed",
          stripeTransferId: businessTransfer.id,
        });
        await db.update(wallets).set({
          balance: businessWallet.balance + businessAmount,
          totalEarned: businessWallet.totalEarned + businessAmount,
          updatedAt: new Date(),
        }).where(eq(wallets.id, businessWallet.id));
      }
    }

    // Driver transaction
    if (order.deliveryPersonId && driverTransfer) {
      const [driverWallet] = await db.select().from(wallets).where(eq(wallets.userId, order.deliveryPersonId)).limit(1);
      if (driverWallet) {
        await db.insert(transactions).values({
          walletId: driverWallet.id,
          orderId: order.id,
          userId: order.deliveryPersonId,
          type: "delivery_payment",
          amount: deliveryAmount,
          balanceBefore: driverWallet.balance,
          balanceAfter: driverWallet.balance + deliveryAmount,
          description: `Delivery payment for order ${order.id}`,
          status: "completed",
          stripeTransferId: driverTransfer.id,
        });
        await db.update(wallets).set({
          balance: driverWallet.balance + deliveryAmount,
          totalEarned: driverWallet.totalEarned + deliveryAmount,
          updatedAt: new Date(),
        }).where(eq(wallets.id, driverWallet.id));
      }
    }

    res.json({ 
      success: true, 
      message: "Delivery confirmed and funds released",
      businessTransferId: businessTransfer.id,
      driverTransferId: driverTransfer?.id,
    });
  } catch (error: any) {
    console.error("Confirm delivery error:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
