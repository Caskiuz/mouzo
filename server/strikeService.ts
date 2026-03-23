import { db } from "./db";
import { deliveryDrivers, users } from "@shared/schema-mysql";
import { eq } from "drizzle-orm";
import { logger } from "./logger";
import { sendPushToUser } from "./enhancedPushService";

export async function addStrike(
  driverId: string,
  reason: string,
  orderId?: string,
): Promise<void> {
  const [driver] = await db
    .select()
    .from(deliveryDrivers)
    .where(eq(deliveryDrivers.userId, driverId))
    .limit(1);
  if (!driver) return;

  const newStrikes = driver.strikes + 1;
  const shouldBlock = newStrikes >= 3;

  await db
    .update(deliveryDrivers)
    .set({
      strikes: newStrikes,
      isBlocked: shouldBlock,
      blockedReason: shouldBlock ? `3 strikes: ${reason}` : null,
      blockedUntil: shouldBlock
        ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        : null,
    })
    .where(eq(deliveryDrivers.userId, driverId));

  logger.security(`Strike added to driver`, {
    driverId,
    strikes: newStrikes,
    reason,
    orderId,
    blocked: shouldBlock,
  });

  if (shouldBlock) {
    await sendPushToUser(driverId, {
      title: "⛔ Cuenta suspendida",
      body: "Recibiste 3 strikes. Tu cuenta está suspendida por 7 días.",
      data: { screen: "DriverProfile" },
    });
  } else {
    await sendPushToUser(driverId, {
      title: `⚠️ Strike ${newStrikes}/3`,
      body: `${reason}. Al llegar a 3 strikes tu cuenta será suspendida.`,
      data: { screen: "DriverProfile" },
    });
  }
}

export async function removeStrike(driverId: string): Promise<void> {
  const [driver] = await db
    .select()
    .from(deliveryDrivers)
    .where(eq(deliveryDrivers.userId, driverId))
    .limit(1);
  if (!driver || driver.strikes === 0) return;

  await db
    .update(deliveryDrivers)
    .set({
      strikes: Math.max(0, driver.strikes - 1),
    })
    .where(eq(deliveryDrivers.userId, driverId));

  logger.info("Strike removed from driver", { driverId });
}

export async function unblockDriver(driverId: string): Promise<void> {
  await db
    .update(deliveryDrivers)
    .set({
      isBlocked: false,
      blockedReason: null,
      blockedUntil: null,
      strikes: 0,
    })
    .where(eq(deliveryDrivers.userId, driverId));

  logger.info("Driver unblocked", { driverId });
}
