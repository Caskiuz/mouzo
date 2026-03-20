import express from "express";
import { authenticateToken, requireRole } from "../authMiddleware";
import { sql } from "drizzle-orm";

const router = express.Router();

// GET /api/admin/finance/platform-earnings - Ganancias de la plataforma
router.get("/platform-earnings", authenticateToken, requireRole("admin", "super_admin"), async (req, res) => {
  try {
    const { orders, transactions } = await import("@shared/schema-mysql");
    const { db } = await import("../db");

    // Obtener todos los pedidos completados
    const allOrders = await db.select().from(orders);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    // Filtrar pedidos entregados
    const deliveredOrders = allOrders.filter(o => o.status === "delivered");

    // Calcular comisiones por período
    const todayEarnings = deliveredOrders
      .filter(o => new Date(o.createdAt) >= today)
      .reduce((sum, o) => sum + (o.nemyCommission || 0), 0);

    const weekEarnings = deliveredOrders
      .filter(o => new Date(o.createdAt) >= weekAgo)
      .reduce((sum, o) => sum + (o.nemyCommission || 0), 0);

    const monthEarnings = deliveredOrders
      .filter(o => new Date(o.createdAt) >= monthStart)
      .reduce((sum, o) => sum + (o.nemyCommission || 0), 0);

    const totalEarnings = deliveredOrders
      .reduce((sum, o) => sum + (o.nemyCommission || 0), 0);

    // Obtener transacciones de la plataforma
    const allTransactions = await db.select().from(transactions);
    
    const penalties = allTransactions
      .filter(t => t.type === "penalty")
      .reduce((sum, t) => sum + t.amount, 0);

    const couponsApplied = allTransactions
      .filter(t => t.type === "coupon_discount")
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    // Transacciones recientes (últimas 50)
    const recentTransactions = deliveredOrders
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 50)
      .map(order => ({
        id: order.id,
        orderId: order.id,
        date: order.createdAt,
        amount: order.nemyCommission || 0,
        type: "commission",
        businessName: order.businessName,
        status: order.status,
      }));

    res.json({
      success: true,
      earnings: {
        today: todayEarnings,
        week: weekEarnings,
        month: monthEarnings,
        total: totalEarnings,
      },
      breakdown: {
        productMarkup: totalEarnings,
        deliveryCommission: 0, // MOUZO no cobra comisión de delivery
        businessCommission: 0, // MOUZO no cobra comisión a negocios
        penalties: penalties,
        couponsApplied: -couponsApplied,
        netTotal: totalEarnings + penalties - couponsApplied,
      },
      transactions: recentTransactions,
      stats: {
        totalOrders: deliveredOrders.length,
        avgCommissionPerOrder: deliveredOrders.length > 0 
          ? Math.round(totalEarnings / deliveredOrders.length) 
          : 0,
        conversionRate: allOrders.length > 0
          ? ((deliveredOrders.length / allOrders.length) * 100).toFixed(1)
          : "0.0",
      },
    });
  } catch (error: any) {
    console.error("Platform earnings error:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/admin/finance/stripe-status - Estado de Stripe Connect
router.get("/stripe-status", authenticateToken, requireRole("admin", "super_admin"), async (req, res) => {
  try {
    // Verificar si Stripe está configurado
    const stripeConfigured = !!process.env.STRIPE_SECRET_KEY;
    
    if (!stripeConfigured) {
      return res.json({
        success: true,
        status: {
          isConnected: false,
          accountId: null,
          chargesEnabled: false,
          payoutsEnabled: false,
          requirements: ["Configurar Stripe Secret Key"],
          lastSync: null,
          balance: {
            available: 0,
            pending: 0,
          },
        },
      });
    }

    // Si Stripe está configurado, obtener información real
    try {
      const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
      const balance = await stripe.balance.retrieve();
      
      res.json({
        success: true,
        status: {
          isConnected: true,
          accountId: "Platform Account",
          chargesEnabled: true,
          payoutsEnabled: true,
          requirements: [],
          lastSync: new Date().toISOString(),
          balance: {
            available: balance.available[0]?.amount || 0,
            pending: balance.pending[0]?.amount || 0,
          },
        },
      });
    } catch (stripeError: any) {
      console.error("Stripe API error:", stripeError);
      res.json({
        success: true,
        status: {
          isConnected: true,
          accountId: "Platform Account",
          chargesEnabled: true,
          payoutsEnabled: true,
          requirements: [],
          lastSync: new Date().toISOString(),
          balance: {
            available: 0,
            pending: 0,
          },
          error: "No se pudo conectar con Stripe API",
        },
      });
    }
  } catch (error: any) {
    console.error("Stripe status error:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/admin/finance/top-businesses - Negocios que más comisiones generan
router.get("/top-businesses", authenticateToken, requireRole("admin", "super_admin"), async (req, res) => {
  try {
    const { orders, businesses } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const { eq } = await import("drizzle-orm");

    const allOrders = await db.select().from(orders);
    const deliveredOrders = allOrders.filter(o => o.status === "delivered");

    // Agrupar por negocio
    const businessEarnings = new Map<string, { name: string; total: number; orders: number }>();

    for (const order of deliveredOrders) {
      const current = businessEarnings.get(order.businessId) || {
        name: order.businessName,
        total: 0,
        orders: 0,
      };
      
      current.total += order.nemyCommission || 0;
      current.orders += 1;
      businessEarnings.set(order.businessId, current);
    }

    // Convertir a array y ordenar
    const topBusinesses = Array.from(businessEarnings.entries())
      .map(([id, data]) => ({
        businessId: id,
        businessName: data.name,
        totalCommissions: data.total,
        totalOrders: data.orders,
        avgCommissionPerOrder: Math.round(data.total / data.orders),
      }))
      .sort((a, b) => b.totalCommissions - a.totalCommissions)
      .slice(0, 10);

    res.json({
      success: true,
      topBusinesses,
    });
  } catch (error: any) {
    console.error("Top businesses error:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/admin/finance/earnings-chart - Datos para gráfica de ganancias
router.get("/earnings-chart", authenticateToken, requireRole("admin", "super_admin"), async (req, res) => {
  try {
    const { orders } = await import("@shared/schema-mysql");
    const { db } = await import("../db");

    const days = parseInt(req.query.days as string) || 30;
    const allOrders = await db.select().from(orders);
    const deliveredOrders = allOrders.filter(o => o.status === "delivered");

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Agrupar por día
    const dailyEarnings = new Map<string, number>();

    for (const order of deliveredOrders) {
      const orderDate = new Date(order.createdAt);
      if (orderDate >= startDate) {
        const dateKey = orderDate.toISOString().split("T")[0];
        const current = dailyEarnings.get(dateKey) || 0;
        dailyEarnings.set(dateKey, current + (order.nemyCommission || 0));
      }
    }

    // Convertir a array ordenado
    const chartData = Array.from(dailyEarnings.entries())
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => a.date.localeCompare(b.date));

    res.json({
      success: true,
      chartData,
    });
  } catch (error: any) {
    console.error("Earnings chart error:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/admin/finance/export-csv - Exportar transacciones a CSV
router.post("/export-csv", authenticateToken, requireRole("admin", "super_admin"), async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    const { orders } = await import("@shared/schema-mysql");
    const { db } = await import("../db");

    const allOrders = await db.select().from(orders);
    let filteredOrders = allOrders.filter(o => o.status === "delivered");

    if (startDate) {
      filteredOrders = filteredOrders.filter(o => new Date(o.createdAt) >= new Date(startDate));
    }
    if (endDate) {
      filteredOrders = filteredOrders.filter(o => new Date(o.createdAt) <= new Date(endDate));
    }

    // Generar CSV
    const csvHeader = "Fecha,Pedido ID,Negocio,Comisión (MXN),Estado\n";
    const csvRows = filteredOrders.map(order => {
      const date = new Date(order.createdAt).toLocaleDateString("es-MX");
      const commission = ((order.nemyCommission || 0) / 100).toFixed(2);
      return `${date},${order.id},${order.businessName},${commission},${order.status}`;
    }).join("\n");

    const csv = csvHeader + csvRows;

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=comisiones_${Date.now()}.csv`);
    res.send(csv);
  } catch (error: any) {
    console.error("Export CSV error:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
