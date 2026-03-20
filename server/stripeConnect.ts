// Complete Stripe Connect Integration for MOUZO - Production Ready
import { stripe } from "./stripeClient";
import { db } from "./db";
import { orders, businesses, users, transactions } from "@shared/schema-mysql";
import { eq, and } from "drizzle-orm";
import { financialService } from "./unifiedFinancialService";

interface ConnectAccountSetup {
  businessId: string;
  email: string;
  businessName: string;
  businessType: "restaurant" | "grocery" | "pharmacy" | "retail";
  country?: string;
}

interface PaymentDistribution {
  platformAmount: number;
  businessAmount: number;
  deliveryAmount: number;
  totalAmount: number;
}

// Create Stripe Connect account for business
export async function createBusinessConnectAccount(setup: ConnectAccountSetup) {
  try {
    console.log(
      `🏪 Creating Stripe Connect account for business: ${setup.businessName}`,
    );

    const account = await stripe.accounts.create({
      type: "express",
      country: setup.country || "MX",
      email: setup.email,
      business_profile: {
        name: setup.businessName,
        product_description: `${setup.businessType} delivery services`,
      },
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      settings: {
        payouts: {
          schedule: {
            interval: "daily",
          },
        },
      },
      metadata: {
        businessId: setup.businessId,
        businessType: setup.businessType,
        platform: "MOUZO",
      },
    });

    // Update business with Stripe account ID
    await db
      .update(businesses)
      .set({
        stripeAccountId: account.id,
        stripeAccountStatus: "pending",
        updatedAt: new Date(),
      })
      .where(eq(businesses.id, setup.businessId));

    console.log(`✅ Stripe Connect account created: ${account.id}`);
    return { success: true, accountId: account.id };
  } catch (error: any) {
    console.error(`❌ Error creating Connect account:`, error);
    return { success: false, error: error.message };
  }
}

// Create onboarding link for business
export async function createBusinessOnboardingLink(
  businessId: string,
  accountId: string,
) {
  try {
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:8081";

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${frontendUrl}/business/stripe/refresh?businessId=${businessId}`,
      return_url: `${frontendUrl}/business/stripe/success?businessId=${businessId}`,
      type: "account_onboarding",
    });

    console.log(`🔗 Onboarding link created for business ${businessId}`);
    return { success: true, url: accountLink.url };
  } catch (error: any) {
    console.error(`❌ Error creating onboarding link:`, error);
    return { success: false, error: error.message };
  }
}

// Check account status and update business
export async function updateBusinessAccountStatus(accountId: string) {
  try {
    const account = await stripe.accounts.retrieve(accountId);

    const status =
      account.charges_enabled && account.payouts_enabled ? "active" : "pending";

    await db
      .update(businesses)
      .set({
        stripeAccountStatus: status,
        updatedAt: new Date(),
      })
      .where(eq(businesses.stripeAccountId, accountId));

    return {
      success: true,
      status,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
    };
  } catch (error: any) {
    console.error(`❌ Error updating account status:`, error);
    return { success: false, error: error.message };
  }
}

// Process payment with automatic commission distribution
export async function processOrderPaymentWithCommissions(orderId: string) {
  try {
    console.log(`💳 Processing payment with commissions for order: ${orderId}`);

    // Get order details
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) {
      throw new Error(`Order not found: ${orderId}`);
    }

    // Get business Stripe account
    const [business] = await db
      .select({
        stripeAccountId: businesses.stripeAccountId,
        name: businesses.name,
      })
      .from(businesses)
      .where(eq(businesses.id, order.businessId))
      .limit(1);

    if (!business?.stripeAccountId) {
      throw new Error(
        `Business ${order.businessId} has no Stripe Connect account`,
      );
    }

    // Calculate commission distribution using unified financial service
    const commissions = await financialService.calculateCommissions(
      order.total,
      order.deliveryFee || 0,
      order.productosBase || undefined,
      order.nemyCommission || undefined
    );

    const distribution: PaymentDistribution = {
      platformAmount: commissions.platform,
      businessAmount: commissions.business,
      deliveryAmount: commissions.driver,
      totalAmount: commissions.total,
    };

    // Create payment intent with application fee (platform commission)
    const paymentIntent = await stripe.paymentIntents.create({
      amount: order.total,
      currency: "mxn",
      application_fee_amount: distribution.platformAmount,
      transfer_data: {
        destination: business.stripeAccountId,
      },
      metadata: {
        orderId: orderId,
        businessId: order.businessId,
        platformAmount: distribution.platformAmount.toString(),
        businessAmount: distribution.businessAmount.toString(),
        deliveryAmount: distribution.deliveryAmount.toString(),
      },
      description: `MOUZO Order ${orderId} - ${business.name}`,
      statement_descriptor: "MOUZO DELIVERY",
    });

    // Update order with payment intent
    await db
      .update(orders)
      .set({
        stripePaymentIntentId: paymentIntent.id,
        platformFee: distribution.platformAmount,
        businessEarnings: distribution.businessAmount,
        deliveryEarnings: distribution.deliveryAmount,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId));

    console.log(`✅ Payment intent created with commissions:`, {
      paymentIntentId: paymentIntent.id,
      distribution,
    });

    return {
      success: true,
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
      distribution,
    };
  } catch (error: any) {
    console.error(`❌ Error processing payment with commissions:`, error);
    return { success: false, error: error.message };
  }
}

// Transfer delivery commission to driver after successful delivery
export async function transferDeliveryCommission(orderId: string) {
  try {
    console.log(`🚚 Transferring delivery commission for order: ${orderId}`);

    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order || !order.deliveryPersonId) {
      throw new Error(`Order ${orderId} has no delivery person assigned`);
    }

    // Get driver's Stripe account (if they have one)
    const [driver] = await db
      .select({ stripeAccountId: users.stripeAccountId, name: users.name })
      .from(users)
      .where(eq(users.id, order.deliveryPersonId))
      .limit(1);

    if (!driver?.stripeAccountId) {
      console.log(
        `⚠️ Driver has no Stripe account, commission will be held in platform wallet`,
      );
      // TODO: Add to driver's internal wallet when wallet system is implemented
      return { success: true, method: "internal_wallet" };
    }

    // Transfer delivery commission to driver's Stripe account
    const transfer = await stripe.transfers.create({
      amount: order.deliveryEarnings || 0,
      currency: "mxn",
      destination: driver.stripeAccountId,
      metadata: {
        orderId: orderId,
        driverId: order.deliveryPersonId,
        type: "delivery_commission",
      },
      description: `Delivery commission for order ${orderId}`,
    });

    // Record transaction
    await db.insert(transactions).values({
      id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      orderId: orderId,
      businessId: order.businessId,
      userId: order.deliveryPersonId,
      amount: order.deliveryEarnings || 0,
      type: "delivery_payment",
      status: "completed",
      stripeTransferId: transfer.id,
      metadata: JSON.stringify({
        transferId: transfer.id,
        driverName: driver.name,
      }),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log(`✅ Delivery commission transferred: ${transfer.id}`);
    return {
      success: true,
      transferId: transfer.id,
      method: "stripe_transfer",
    };
  } catch (error: any) {
    console.error(`❌ Error transferring delivery commission:`, error);
    return { success: false, error: error.message };
  }
}

// Process refund with commission adjustments
export async function processRefundWithCommissions(
  orderId: string,
  refundAmount?: number,
) {
  try {
    console.log(`💸 Processing refund for order: ${orderId}`);

    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order || !order.stripePaymentIntentId) {
      throw new Error(`Order ${orderId} has no payment to refund`);
    }

    const amount = refundAmount || order.total;

    // Create refund
    const refund = await stripe.refunds.create({
      payment_intent: order.stripePaymentIntentId,
      amount: amount,
      reason: "requested_by_customer",
      metadata: {
        orderId: orderId,
        originalAmount: order.total.toString(),
      },
    });

    // Update order
    await db
      .update(orders)
      .set({
        status: amount === order.total ? "refunded" : "partially_refunded",
        refundAmount: amount,
        refundedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId));

    // Record refund transaction
    await db.insert(transactions).values({
      id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      orderId: orderId,
      businessId: order.businessId,
      userId: order.userId,
      amount: -amount,
      type: "refund",
      status: "completed",
      stripeRefundId: refund.id,
      metadata: JSON.stringify({
        refundId: refund.id,
        originalAmount: order.total,
      }),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log(`✅ Refund processed: ${refund.id}`);
    return { success: true, refundId: refund.id, amount };
  } catch (error: any) {
    console.error(`❌ Error processing refund:`, error);
    return { success: false, error: error.message };
  }
}

// Get business payout history
export async function getBusinessPayouts(businessId: string) {
  try {
    const [business] = await db
      .select({ stripeAccountId: businesses.stripeAccountId })
      .from(businesses)
      .where(eq(businesses.id, businessId))
      .limit(1);

    if (!business?.stripeAccountId) {
      return { success: false, error: "Business has no Stripe account" };
    }

    const payouts = await stripe.payouts.list(
      { limit: 20 },
      { stripeAccount: business.stripeAccountId },
    );

    return { success: true, payouts: payouts.data };
  } catch (error: any) {
    console.error(`❌ Error getting business payouts:`, error);
    return { success: false, error: error.message };
  }
}

// Webhook handler for Connect account updates
export async function handleConnectAccountUpdate(account: any) {
  try {
    console.log(`🔄 Processing Connect account update: ${account.id}`);

    const status =
      account.charges_enabled && account.payouts_enabled ? "active" : "pending";

    await db
      .update(businesses)
      .set({
        stripeAccountStatus: status,
        updatedAt: new Date(),
      })
      .where(eq(businesses.stripeAccountId, account.id));

    console.log(`✅ Business account status updated to: ${status}`);
  } catch (error) {
    console.error(`❌ Error handling Connect account update:`, error);
  }
}

// Initialize Stripe Connect for existing businesses
export async function initializeExistingBusinesses() {
  try {
    console.log(`🔄 Initializing Stripe Connect for existing businesses...`);

    const businessesWithoutStripe = await db
      .select()
      .from(businesses)
      .where(eq(businesses.stripeAccountId, null));

    for (const business of businessesWithoutStripe) {
      if (business.email) {
        const result = await createBusinessConnectAccount({
          businessId: business.id,
          email: business.email,
          businessName: business.name,
          businessType: (business.type as any) || "restaurant",
        });

        if (result.success) {
          console.log(`✅ Created Stripe account for ${business.name}`);
        } else {
          console.error(
            `❌ Failed to create account for ${business.name}: ${result.error}`,
          );
        }
      }
    }

    console.log(`✅ Stripe Connect initialization completed`);
  } catch (error) {
    console.error(`❌ Error initializing Stripe Connect:`, error);
  }
}
