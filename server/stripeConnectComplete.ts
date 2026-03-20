import Stripe from "stripe";
import { db } from "./db";
import { stripeConnectAccounts, users, businesses } from "@shared/schema-mysql";
import { eq } from "drizzle-orm";
import { logger } from "./logger";
import { AppError } from "./errors";

// Lazy-loaded Stripe instance
let stripeInstance: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripeInstance) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new AppError(500, "Stripe is not configured. Please add STRIPE_SECRET_KEY.");
    }
    stripeInstance = new Stripe(key, {
      apiVersion: "2024-12-18.acacia",
    });
  }
  return stripeInstance;
}

export async function createConnectAccount(
  userId: string,
  accountType: "business" | "driver",
): Promise<string> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) throw new AppError(404, "User not found");

  const [existing] = await db
    .select()
    .from(stripeConnectAccounts)
    .where(eq(stripeConnectAccounts.userId, userId))
    .limit(1);
  if (existing) return existing.stripeAccountId;

  const account = await getStripe().accounts.create({
    type: "express",
    country: "MX",
    email: user.email || undefined,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    business_type: accountType === "business" ? "company" : "individual",
  });

  await db.insert(stripeConnectAccounts).values({
    userId,
    stripeAccountId: account.id,
    accountType,
    onboardingComplete: false,
    chargesEnabled: false,
    payoutsEnabled: false,
    detailsSubmitted: false,
  });

  logger.info("Stripe Connect account created", {
    userId,
    accountId: account.id,
    accountType,
  });

  return account.id;
}

export async function createOnboardingLink(userId: string): Promise<string> {
  const [account] = await db
    .select()
    .from(stripeConnectAccounts)
    .where(eq(stripeConnectAccounts.userId, userId))
    .limit(1);
  if (!account) throw new AppError(404, "Connect account not found");

  const accountLink = await getStripe().accountLinks.create({
    account: account.stripeAccountId,
    refresh_url: `${process.env.FRONTEND_URL}/onboarding/refresh`,
    return_url: `${process.env.FRONTEND_URL}/onboarding/complete`,
    type: "account_onboarding",
  });

  logger.info("Onboarding link created", {
    userId,
    accountId: account.stripeAccountId,
  });

  return accountLink.url;
}

export async function getAccountStatus(userId: string): Promise<any> {
  const [account] = await db
    .select()
    .from(stripeConnectAccounts)
    .where(eq(stripeConnectAccounts.userId, userId))
    .limit(1);
  if (!account) return null;

  const stripeAccount = await getStripe().accounts.retrieve(account.stripeAccountId);

  return {
    accountId: account.stripeAccountId,
    chargesEnabled: stripeAccount.charges_enabled,
    payoutsEnabled: stripeAccount.payouts_enabled,
    detailsSubmitted: stripeAccount.details_submitted,
    requirements: stripeAccount.requirements,
  };
}

export async function createPayout(
  userId: string,
  amount: number,
): Promise<string> {
  const [account] = await db
    .select()
    .from(stripeConnectAccounts)
    .where(eq(stripeConnectAccounts.userId, userId))
    .limit(1);
  if (!account) throw new AppError(404, "Connect account not found");

  if (!account.payoutsEnabled)
    throw new AppError(400, "Payouts not enabled for this account");

  const transfer = await getStripe().transfers.create({
    amount,
    currency: "mxn",
    destination: account.stripeAccountId,
    metadata: { userId },
  });

  logger.payment("Payout created", { userId, amount, transferId: transfer.id });

  return transfer.id;
}

export async function distributeOrderCommissions(
  orderId: string,
  businessId: string,
  driverId: string | null,
  amounts: {
    business: number;
    driver: number;
  },
): Promise<void> {
  const [businessAccount] = await db
    .select()
    .from(stripeConnectAccounts)
    .where(eq(stripeConnectAccounts.userId, businessId))
    .limit(1);

  if (businessAccount && businessAccount.payoutsEnabled) {
    await getStripe().transfers.create({
      amount: amounts.business,
      currency: "mxn",
      destination: businessAccount.stripeAccountId,
      metadata: { orderId, userId: businessId, type: "business_commission" },
    });
  }

  if (driverId) {
    const [driverAccount] = await db
      .select()
      .from(stripeConnectAccounts)
      .where(eq(stripeConnectAccounts.userId, driverId))
      .limit(1);

    if (driverAccount && driverAccount.payoutsEnabled) {
      await getStripe().transfers.create({
        amount: amounts.driver,
        currency: "mxn",
        destination: driverAccount.stripeAccountId,
        metadata: { orderId, userId: driverId, type: "driver_commission" },
      });
    }
  }

  logger.payment("Commissions distributed", {
    orderId,
    businessAmount: amounts.business,
    driverAmount: amounts.driver,
  });
}
