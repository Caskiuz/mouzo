// Fund Release Service - Maneja la liberación de fondos pendientes
import { db } from "./db";
import { orders, wallets, transactions } from "@shared/schema-mysql";
import { eq, and, lt, isNull } from "drizzle-orm";
import { financialService } from "./unifiedFinancialService";
import { logger } from "./logger";

interface FundReleaseResult {
  success: boolean;
  message: string;
  orderId?: string;
  amountReleased?: number;
}

export class FundReleaseService {
  private static instance: FundReleaseService;

  private constructor() {}

  static getInstance(): FundReleaseService {
    if (!FundReleaseService.instance) {
      FundReleaseService.instance = new FundReleaseService();
    }
    return FundReleaseService.instance;
  }

  // Release funds when customer confirms delivery
  async releaseOnCustomerConfirmation(orderId: string, customerId: string): Promise<FundReleaseResult> {
    try {
      const [order] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, orderId))
        .limit(1);

      if (!order) {
        return { success: false, message: "Pedido no encontrado" };
      }

      if (order.userId !== customerId) {
        return { success: false, message: "No autorizado" };
      }

      if (order.status !== "delivered") {
        return { success: false, message: "El pedido aún no ha sido entregado" };
      }

      if (order.fundsReleased) {
        return { success: false, message: "Los fondos ya fueron liberados" };
      }

      await this.releaseFunds(order);

      logger.info(`✅ Funds released by customer confirmation: Order ${orderId}`, {
        orderId,
        customerId,
        businessId: order.businessId,
        driverId: order.deliveryPersonId,
      });

      return {
        success: true,
        message: "Fondos liberados exitosamente",
        orderId: order.id,
        amountReleased: order.total,
      };
    } catch (error: any) {
      logger.error("Error releasing funds on customer confirmation:", error);
      return { success: false, message: error.message };
    }
  }

  // Auto-release funds after timeout (24h default)
  async autoReleaseFunds(): Promise<{ released: number; failed: number }> {
    try {
      const now = new Date();
      
      // Find orders ready for auto-release:
      // - Status: delivered
      // - Funds not released yet
      // - Delivered more than 24h ago (or custom autoReleaseAt)
      const deliveredAt24hAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const ordersToRelease = await db
        .select()
        .from(orders)
        .where(
          and(
            eq(orders.status, "delivered"),
            eq(orders.fundsReleased, false),
            lt(orders.deliveredAt, deliveredAt24hAgo)
          )
        );

      let released = 0;
      let failed = 0;

      for (const order of ordersToRelease) {
        try {
          await this.releaseFunds(order);
          released++;
          
          logger.info(`⏰ Auto-released funds: Order ${order.id}`, {
            orderId: order.id,
            deliveredAt: order.deliveredAt,
            hoursElapsed: Math.floor((now.getTime() - new Date(order.deliveredAt!).getTime()) / (1000 * 60 * 60)),
          });
        } catch (error: any) {
          failed++;
          logger.error(`Failed to auto-release funds for order ${order.id}:`, error);
        }
      }

      logger.info(`🔄 Auto-release batch completed: ${released} released, ${failed} failed`);

      return { released, failed };
    } catch (error: any) {
      logger.error("Error in auto-release funds:", error);
      return { released: 0, failed: 0 };
    }
  }

  // Internal method to actually release the funds
  private async releaseFunds(order: any): Promise<void> {
    await db.transaction(async (tx) => {
      // Move funds from pending to available for business
      await this.movePendingToAvailable(
        tx,
        order.businessId,
        order.businessEarnings || 0,
        order.id,
        "Pago liberado de pedido"
      );

      // Move funds from pending to available for driver
      if (order.deliveryPersonId && order.deliveryEarnings) {
        await this.movePendingToAvailable(
          tx,
          order.deliveryPersonId,
          order.deliveryEarnings,
          order.id,
          "Pago de entrega liberado"
        );
      }

      // Update order
      await tx
        .update(orders)
        .set({
          fundsReleased: true,
          fundsReleasedAt: new Date(),
          confirmedByCustomer: true,
          confirmedByCustomerAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(orders.id, order.id));
    });
  }

  // Move funds from pendingBalance to balance
  private async movePendingToAvailable(
    tx: any,
    userId: string,
    amount: number,
    orderId: string,
    description: string
  ): Promise<void> {
    const [wallet] = await tx
      .select()
      .from(wallets)
      .where(eq(wallets.userId, userId))
      .limit(1);

    if (!wallet) {
      throw new Error(`Wallet not found for user ${userId}`);
    }

    // Decrease pending balance
    const newPendingBalance = wallet.pendingBalance - amount;
    // Increase available balance
    const newBalance = wallet.balance + amount;

    await tx
      .update(wallets)
      .set({
        pendingBalance: newPendingBalance,
        balance: newBalance,
        updatedAt: new Date(),
      })
      .where(eq(wallets.userId, userId));

    // Record transaction
    await tx.insert(transactions).values({
      walletId: wallet.id,
      userId,
      orderId,
      type: "funds_released",
      amount,
      balanceBefore: wallet.balance,
      balanceAfter: newBalance,
      description: `${description} #${orderId.slice(-6)}`,
      status: "completed",
      metadata: JSON.stringify({
        previousPending: wallet.pendingBalance,
        newPending: newPendingBalance,
        previousBalance: wallet.balance,
        newBalance,
        timestamp: new Date().toISOString(),
      }),
    });
  }

  // Get orders pending fund release
  async getPendingReleaseOrders() {
    const now = new Date();
    const deliveredAt24hAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    return await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.status, "delivered"),
          eq(orders.fundsReleased, false),
          lt(orders.deliveredAt, deliveredAt24hAgo)
        )
      );
  }

  // Dispute order - prevent fund release
  async disputeOrder(orderId: string, customerId: string, reason: string): Promise<FundReleaseResult> {
    try {
      const [order] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, orderId))
        .limit(1);

      if (!order) {
        return { success: false, message: "Pedido no encontrado" };
      }

      if (order.userId !== customerId) {
        return { success: false, message: "No autorizado" };
      }

      if (order.fundsReleased) {
        return { success: false, message: "Los fondos ya fueron liberados. Contacta soporte." };
      }

      await db
        .update(orders)
        .set({
          status: "disputed",
          cancellationReason: reason,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, orderId));

      logger.warn(`⚠️ Order disputed by customer: ${orderId}`, {
        orderId,
        customerId,
        reason,
      });

      return {
        success: true,
        message: "Disputa registrada. Un administrador revisará tu caso.",
        orderId: order.id,
      };
    } catch (error: any) {
      logger.error("Error disputing order:", error);
      return { success: false, message: error.message };
    }
  }
}

export const fundReleaseService = FundReleaseService.getInstance();
