import Stripe from "stripe";
import { db } from "./db";
import {
  orders,
  wallets,
  transactions,
  withdrawals,
} from "@shared/schema-mysql";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

// Lazy-loaded Stripe instance
let stripeInstance: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripeInstance) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("Stripe is not configured. Please add STRIPE_SECRET_KEY.");
    }
    stripeInstance = new Stripe(key, {
      apiVersion: "2024-12-18.acacia",
    });
  }
  return stripeInstance;
}

const stripe = new Proxy({} as Stripe, {
  get(_, prop) {
    return (getStripe() as any)[prop];
  }
});

const processedEvents = new Set<string>();

export async function handleStripeWebhook(event: Stripe.Event): Promise<void> {
  if (processedEvents.has(event.id)) {
    logger.warn("Duplicate webhook event", { eventId: event.id });
    return;
  }

  logger.webhook("Processing webhook", { eventId: event.id, type: event.type });

  try {
    switch (event.type) {
      case "payment_intent.succeeded":
        await handlePaymentIntentSucceeded(
          event.data.object as Stripe.PaymentIntent,
        );
        break;
      case "payment_intent.payment_failed":
        await handlePaymentIntentFailed(
          event.data.object as Stripe.PaymentIntent,
        );
        break;
      case "charge.refunded":
        await handleChargeRefunded(event.data.object as Stripe.Charge);
        break;
      case "account.updated":
        await handleAccountUpdated(event.data.object as Stripe.Account);
        break;
      case "payout.paid":
        await handlePayoutPaid(event.data.object as Stripe.Payout);
        break;
      case "payout.failed":
        await handlePayoutFailed(event.data.object as Stripe.Payout);
        break;
      default:
        logger.debug("Unhandled webhook", { type: event.type });
    }

    processedEvents.add(event.id);
    if (processedEvents.size > 1000) {
      const toDelete = Array.from(processedEvents).slice(0, 100);
      toDelete.forEach((id) => processedEvents.delete(id));
    }
  } catch (error) {
    logger.error("Webhook processing failed", error, {
      eventId: event.id,
      type: event.type,
    });
    throw error;
  }
}

async function handlePaymentIntentSucceeded(
  pi: Stripe.PaymentIntent,
): Promise<void> {
  const orderId = pi.metadata.orderId;
  if (!orderId) return;

  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  if (!order) {
    logger.error("Order not found", { orderId, paymentIntentId: pi.id });
    return;
  }

  await db
    .update(orders)
    .set({ 
      status: "accepted", 
      paymentIntentId: pi.id,
      paidAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(orders.id, orderId));

  // Create transaction records for business and platform
  const { businesses, wallets } = await import("@shared/schema-mysql");
  const [business] = await db.select().from(businesses).where(eq(businesses.id, order.businessId)).limit(1);
  
  if (business && business.ownerId) {
    const [businessWallet] = await db.select().from(wallets).where(eq(wallets.userId, business.ownerId)).limit(1);
    if (businessWallet) {
      const businessEarnings = order.businessEarnings || order.productosBase || 0;
      await db.insert(transactions).values({
        walletId: businessWallet.id,
        orderId,
        businessId: business.id,
        userId: business.ownerId,
        type: "income",
        amount: businessEarnings,
        balanceBefore: businessWallet.balance,
        balanceAfter: businessWallet.balance + businessEarnings,
        description: `Payment for order ${orderId}`,
        status: "completed",
        stripePaymentIntentId: pi.id,
      });

      await db.update(wallets).set({
        balance: businessWallet.balance + businessEarnings,
        totalEarned: businessWallet.totalEarned + businessEarnings,
        updatedAt: new Date(),
      }).where(eq(wallets.id, businessWallet.id));
    }
  }

  logger.payment("Payment confirmed", { orderId, amount: pi.amount });
}

async function handlePaymentIntentFailed(
  pi: Stripe.PaymentIntent,
): Promise<void> {
  const orderId = pi.metadata.orderId;
  if (!orderId) return;

  await db
    .update(orders)
    .set({
      status: "cancelled",
      cancelledAt: new Date(),
      cancelledBy: "system",
      cancellationReason: "Payment failed",
    })
    .where(eq(orders.id, orderId));

  logger.payment("Payment failed", {
    orderId,
    error: pi.last_payment_error?.message,
  });
}

async function handleChargeRefunded(charge: Stripe.Charge): Promise<void> {
  const piId = charge.payment_intent as string;
  if (!piId) return;

  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.paymentIntentId, piId))
    .limit(1);
  if (!order) return;

  await db
    .update(orders)
    .set({
      refundAmount: charge.amount_refunded,
      refundStatus: "processed",
    })
    .where(eq(orders.id, order.id));

  logger.payment("Refund processed", {
    orderId: order.id,
    amount: charge.amount_refunded,
  });
}

async function handleAccountUpdated(account: Stripe.Account): Promise<void> {
  const { stripeConnectAccounts } = await import("@shared/schema-mysql");

  await db
    .update(stripeConnectAccounts)
    .set({
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
      requirements: JSON.stringify(account.requirements),
    })
    .where(eq(stripeConnectAccounts.stripeAccountId, account.id));

  logger.webhook("Account updated", { accountId: account.id });
}

async function handlePayoutPaid(payout: Stripe.Payout): Promise<void> {
  const [withdrawal] = await db
    .select()
    .from(withdrawals)
    .where(eq(withdrawals.stripePayoutId, payout.id))
    .limit(1);
  if (!withdrawal) return;

  await db
    .update(withdrawals)
    .set({
      status: "completed",
      processedAt: new Date(),
    })
    .where(eq(withdrawals.id, withdrawal.id));

  logger.payment("Payout completed", {
    withdrawalId: withdrawal.id,
    amount: payout.amount,
  });
}

async function handlePayoutFailed(payout: Stripe.Payout): Promise<void> {
  const [withdrawal] = await db
    .select()
    .from(withdrawals)
    .where(eq(withdrawals.stripePayoutId, payout.id))
    .limit(1);
  if (!withdrawal) return;

  await db
    .update(withdrawals)
    .set({
      status: "failed",
      failureReason: payout.failure_message || "Payout failed",
    })
    .where(eq(withdrawals.id, withdrawal.id));

  const [wallet] = await db
    .select()
    .from(wallets)
    .where(eq(wallets.id, withdrawal.walletId))
    .limit(1);
  if (wallet) {
    await db
      .update(wallets)
      .set({ balance: wallet.balance + withdrawal.amount })
      .where(eq(wallets.id, wallet.id));
    await db.insert(transactions).values({
      walletId: wallet.id,
      type: "refund",
      amount: withdrawal.amount,
      balanceBefore: wallet.balance,
      balanceAfter: wallet.balance + withdrawal.amount,
      description: "Withdrawal failed - funds returned",
      status: "completed",
    });
  }

  logger.payment("Payout failed", {
    withdrawalId: withdrawal.id,
    error: payout.failure_message,
  });
}
