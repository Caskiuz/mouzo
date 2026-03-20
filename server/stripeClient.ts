// Enhanced Stripe Client for MOUZO - Production Ready
import Stripe from "stripe";
import { db } from "./db";
import { businesses } from "@shared/schema-mysql";
import { eq } from "drizzle-orm";

// Credential caching for performance
interface StripeCredentials {
  secretKey: string;
  publishableKey: string;
  webhookSecret: string;
}

let cachedCredentials: StripeCredentials | null = null;
let stripeInstance: Stripe | null = null;

function getStripeCredentials(): StripeCredentials {
  if (cachedCredentials) return cachedCredentials;

  const secretKey = process.env.STRIPE_SECRET_KEY;
  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secretKey || !publishableKey || !webhookSecret) {
    throw new Error(
      "Missing required Stripe credentials in environment variables",
    );
  }

  // Guard: ensure we never run with an invalid key (e.g., mk_ or pk_)
  if (!secretKey.startsWith("sk_")) {
    throw new Error(
      "Invalid STRIPE_SECRET_KEY format; expected sk_* (check environment variables)",
    );
  }

  cachedCredentials = { secretKey, publishableKey, webhookSecret };
  return cachedCredentials;
}

function getStripeInstance(): Stripe {
  if (stripeInstance) return stripeInstance;

  const credentials = getStripeCredentials();
  stripeInstance = new Stripe(credentials.secretKey, {
    apiVersion: "2024-06-20",
    timeout: 10000,
    maxNetworkRetries: 3,
  });

  return stripeInstance;
}

// Lazy getter - only throws when actually used
export function getStripe(): Stripe {
  return getStripeInstance();
}

// For backwards compatibility - will throw if Stripe not configured
let _stripeProxy: Stripe | null = null;
export const stripe = new Proxy({} as Stripe, {
  get(_, prop) {
    if (!_stripeProxy) {
      try {
        _stripeProxy = getStripeInstance();
      } catch {
        throw new Error("Stripe is not configured. Please add STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY, and STRIPE_WEBHOOK_SECRET.");
      }
    }
    return (_stripeProxy as any)[prop];
  }
});

export async function getConnectedAccountId(
  businessId: string,
): Promise<string | null> {
  if (!businessId?.trim()) {
    throw new Error("Business ID is required");
  }

  try {
    const [business] = await db
      .select({ stripeAccountId: businesses.stripeAccountId })
      .from(businesses)
      .where(eq(businesses.id, businessId))
      .limit(1);

    return business?.stripeAccountId || null;
  } catch (error) {
    console.error(
      `Error getting connected account ID for business ${businessId}:`,
      error,
    );
    throw new Error("Failed to retrieve connected account information");
  }
}

export async function createConnectedAccount(businessData: {
  email: string;
  businessName: string;
  businessType: string;
}) {
  // Input validation
  if (!businessData.email?.trim() || !businessData.businessName?.trim()) {
    return { success: false, error: "Email and business name are required" };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(businessData.email)) {
    return { success: false, error: "Invalid email format" };
  }

  try {
    const account = await stripe.accounts.create({
      type: "express",
      country: "US",
      email: businessData.email.toLowerCase().trim(),
      business_profile: {
        name: businessData.businessName.trim(),
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
    });

    return { success: true, accountId: account.id };
  } catch (error: any) {
    console.error("Error creating connected account:", {
      error: error.message,
      type: error.type,
      code: error.code,
      businessData: {
        email: businessData.email,
        businessName: businessData.businessName,
      },
    });

    // Return user-friendly error messages
    if (error.type === "StripeInvalidRequestError") {
      return { success: false, error: "Invalid account information provided" };
    }

    return {
      success: false,
      error: "Failed to create Stripe account. Please try again.",
    };
  }
}

export async function createAccountLink(accountId: string, businessId: string) {
  if (!accountId?.trim() || !businessId?.trim()) {
    return { success: false, error: "Account ID and business ID are required" };
  }

  const frontendUrl = process.env.FRONTEND_URL;
  if (!frontendUrl) {
    console.error("FRONTEND_URL environment variable not set");
    return { success: false, error: "Configuration error" };
  }

  try {
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${frontendUrl}/business/stripe/refresh?businessId=${businessId}`,
      return_url: `${frontendUrl}/business/stripe/return?businessId=${businessId}`,
      type: "account_onboarding",
    });

    return { success: true, url: accountLink.url };
  } catch (error: any) {
    console.error("Error creating account link:", {
      error: error.message,
      accountId,
      businessId,
    });

    return { success: false, error: "Failed to create onboarding link" };
  }
}

export async function getAccountStatus(accountId: string) {
  if (!accountId?.trim()) {
    throw new Error("Account ID is required");
  }

  try {
    const account = await stripe.accounts.retrieve(accountId);

    return {
      success: true,
      account: {
        id: account.id,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
        detailsSubmitted: account.details_submitted,
        requirements: account.requirements,
      },
    };
  } catch (error: any) {
    console.error(`Error retrieving account status for ${accountId}:`, error);
    return { success: false, error: "Failed to retrieve account status" };
  }
}
