import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { Badge } from "@/components/Badge";
import { useTheme } from "@/hooks/useTheme";
import { useBusiness } from "@/contexts/BusinessContext";
import { Spacing, BorderRadius, RabbitFoodColors, Shadows } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

type Period = "week" | "month" | "all";

interface Transaction {
  id: string;
  orderId: string;
  amount: number;
  status: string;
  createdAt: string;
  customerName?: string;
}

export default function BusinessFinancesScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { selectedBusiness } = useBusiness();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<Period>("week");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState({
    totalEarnings: 0,
    pendingAmount: 0,
    completedAmount: 0,
    transactionCount: 0,
  });

  const loadFinances = async () => {
    try {
      const url = selectedBusiness
        ? `/api/business/finances?businessId=${selectedBusiness.id}&period=${selectedPeriod}`
        : `/api/business/finances?period=${selectedPeriod}`;
      
      const response = await apiRequest("GET", url);
      const data = await response.json();
      
      if (data.success) {
        setTransactions(data.transactions || []);
        setSummary(data.summary || {
          totalEarnings: 0,
          pendingAmount: 0,
          completedAmount: 0,
          transactionCount: 0,
        });
      }
    } catch (error) {
      console.error("Error loading finances:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFinances();
  }, [selectedBusiness?.id, selectedPeriod]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadFinances();
    setRefreshing(false);
  };

  const periodLabels: Record<Period, string> = {
    week: "Esta semana",
    month: "Este mes",
    all: "Todo el tiempo",
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "delivered":
        return RabbitFoodColors.success;
      case "pending":
      case "accepted":
      case "preparing":
      case "on_the_way":
        return RabbitFoodColors.warning;
      case "cancelled":
        return RabbitFoodColors.error;
      default:
        return theme.textSecondary;
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: "Pendiente",
      accepted: "Aceptado",
      preparing: "Preparando",
      on_the_way: "En camino",
      delivered: "Completado",
      cancelled: "Cancelado",
    };
    return labels[status] || status;
  };

  if (loading) {
    return (
      <LinearGradient
        colors={[theme.gradientStart || "#FFFFFF", theme.gradientEnd || "#F5F5F5"]}
        style={styles.container}
      >
        <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
          <ActivityIndicator size="large" color={RabbitFoodColors.primary} />
          <ThemedText style={{ marginTop: Spacing.md }}>Cargando finanzas...</ThemedText>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={[theme.gradientStart || "#FFFFFF", theme.gradientEnd || "#F5F5F5"]}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + Spacing.md, paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={RabbitFoodColors.primary}
          />
        }
      >
        <View style={styles.header}>
          <ThemedText type="h2">Finanzas</ThemedText>
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            {selectedBusiness?.name || "Panel financiero"}
          </ThemedText>
        </View>

        {/* Resumen Financiero */}
        <Animated.View
          entering={FadeInDown.springify()}
          style={[styles.summaryCard, { backgroundColor: "#4CAF50" }, Shadows.lg]}
        >
          <ThemedText type="body" style={{ color: "rgba(255,255,255,0.8)" }}>
            Ganancias Totales
          </ThemedText>
          <ThemedText
            type="h1"
            style={{ color: "#FFFFFF", fontSize: 38, marginVertical: Spacing.sm }}
          >
            ${(summary.totalEarnings / 100).toFixed(2)}
          </ThemedText>

          <View style={styles.periodSelector}>
            {(["week", "month", "all"] as Period[]).map((period) => (
              <Pressable
                key={period}
                onPress={() => setSelectedPeriod(period)}
                style={[
                  styles.periodButton,
                  {
                    backgroundColor:
                      selectedPeriod === period ? "#FFFFFF" : "rgba(255,255,255,0.2)",
                  },
                ]}
              >
                <ThemedText
                  type="small"
                  style={{
                    color: selectedPeriod === period ? "#4CAF50" : "#FFFFFF",
                    fontWeight: "600",
                  }}
                >
                  {periodLabels[period]}
                </ThemedText>
              </Pressable>
            ))}
          </View>

          <View style={styles.summaryDetails}>
            <View style={styles.summaryItem}>
              <ThemedText type="small" style={{ color: "rgba(255,255,255,0.7)" }}>
                Completados
              </ThemedText>
              <ThemedText type="h4" style={{ color: "#FFFFFF" }}>
                ${(summary.completedAmount / 100).toFixed(2)}
              </ThemedText>
            </View>
            <View style={styles.summaryItem}>
              <ThemedText type="small" style={{ color: "rgba(255,255,255,0.7)" }}>
                Pendientes
              </ThemedText>
              <ThemedText type="h4" style={{ color: "#FFFFFF" }}>
                ${(summary.pendingAmount / 100).toFixed(2)}
              </ThemedText>
            </View>
          </View>
        </Animated.View>

        {/* Información de Stripe */}
        <View style={[styles.infoCard, { backgroundColor: theme.card }, Shadows.sm]}>
          <View style={styles.infoHeader}>
            <Feather name="info" size={20} color={RabbitFoodColors.primary} />
            <ThemedText type="h4" style={{ marginLeft: Spacing.sm }}>
              Sistema de Pagos
            </ThemedText>
          </View>
          <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.sm }}>
            • Recibes el 100% del precio base de tus productos
          </ThemedText>
          <ThemedText type="body" style={{ color: theme.textSecondary }}>
            • Rabbit Food agrega un 15% de markup al precio final
          </ThemedText>
          <ThemedText type="body" style={{ color: theme.textSecondary }}>
            • Pagos procesados con Stripe de forma segura
          </ThemedText>
          <ThemedText type="body" style={{ color: theme.textSecondary }}>
            • Liquidación automática al completar pedido
          </ThemedText>
          
          <Pressable
            style={[styles.stripeButton, { backgroundColor: "#635BFF" }]}
            onPress={() => {
              if (typeof window !== "undefined") {
                window.open("https://dashboard.stripe.com/dashboard", "_blank");
              }
            }}
          >
            <Feather name="external-link" size={16} color="#FFFFFF" />
            <ThemedText type="small" style={{ color: "#FFFFFF", marginLeft: Spacing.xs }}>
              Ver en Stripe Dashboard
            </ThemedText>
          </Pressable>
        </View>

        {/* Historial de Transacciones */}
        <View style={styles.sectionHeader}>
          <ThemedText type="h3">Historial de Transacciones</ThemedText>
          <Badge text={`${summary.transactionCount}`} variant="primary" />
        </View>

        {transactions.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: theme.card }, Shadows.sm]}>
            <Feather name="inbox" size={48} color={theme.textSecondary} />
            <ThemedText
              type="body"
              style={{ color: theme.textSecondary, marginTop: Spacing.md }}
            >
              No hay transacciones en este período
            </ThemedText>
          </View>
        ) : (
          transactions.map((transaction, index) => (
            <Animated.View
              key={transaction.id}
              entering={FadeInDown.delay(index * 50).springify()}
              style={[styles.transactionCard, { backgroundColor: theme.card }, Shadows.sm]}
            >
              <View style={styles.transactionHeader}>
                <View style={{ flex: 1 }}>
                  <ThemedText type="body" style={{ fontWeight: "600" }}>
                    Pedido #{transaction.orderId.slice(-6)}
                  </ThemedText>
                  <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                    {transaction.customerName || "Cliente"}
                  </ThemedText>
                  <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                    {new Date(transaction.createdAt).toLocaleDateString("es-VE", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </ThemedText>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <ThemedText
                    type="h4"
                    style={{ color: getStatusColor(transaction.status) }}
                  >
                    ${(transaction.amount / 100).toFixed(2)}
                  </ThemedText>
                  <Badge
                    text={getStatusLabel(transaction.status)}
                    variant={
                      transaction.status === "delivered"
                        ? "success"
                        : transaction.status === "cancelled"
                        ? "error"
                        : "warning"
                    }
                  />
                </View>
              </View>
            </Animated.View>
          ))
        )}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  header: {
    marginBottom: Spacing.lg,
  },
  summaryCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  periodSelector: {
    flexDirection: "row",
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  periodButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
  },
  summaryDetails: {
    flexDirection: "row",
    marginTop: Spacing.lg,
    gap: Spacing.xl,
  },
  summaryItem: {
    alignItems: "center",
  },
  infoCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  infoHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  stripeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  emptyState: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
  },
  transactionCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
  },
  transactionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
});
