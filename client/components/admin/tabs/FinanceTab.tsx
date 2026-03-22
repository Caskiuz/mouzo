import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { Feather } from "@expo/vector-icons";
import { RabbitFoodColors, Spacing } from "../../../constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { apiRequest } from "@/lib/query-client";

interface PlatformEarnings {
  today: number;
  week: number;
  month: number;
  total: number;
}

interface Breakdown {
  productMarkup: number;
  deliveryCommission: number;
  businessCommission: number;
  penalties: number;
  couponsApplied: number;
  netTotal: number;
}

interface Transaction {
  id: string;
  orderId: string;
  date: string;
  amount: number;
  type: string;
  businessName: string;
  status: string;
}

interface StripeStatus {
  isConnected: boolean;
  accountId: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  requirements: string[];
  lastSync: string | null;
  balance: {
    available: number;
    pending: number;
  };
  error?: string;
}

interface TopBusiness {
  businessId: string;
  businessName: string;
  totalCommissions: number;
  totalOrders: number;
  avgCommissionPerOrder: number;
}

interface FinanceTabProps {
  theme: any;
  showToast: (message: string, type?: "success" | "error" | "info") => void;
}

export const FinanceTab: React.FC<FinanceTabProps> = ({ theme, showToast }) => {
  const [loading, setLoading] = useState(true);
  const [earnings, setEarnings] = useState<PlatformEarnings | null>(null);
  const [breakdown, setBreakdown] = useState<Breakdown | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stripeStatus, setStripeStatus] = useState<StripeStatus | null>(null);
  const [topBusinesses, setTopBusinesses] = useState<TopBusiness[]>([]);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    loadFinanceData();
  }, []);

  const loadFinanceData = async () => {
    try {
      setLoading(true);

      // Cargar ganancias de la plataforma
      const earningsRes = await apiRequest("GET", "/api/admin/finance/platform-earnings");
      const earningsData = await earningsRes.json();
      
      if (earningsData.success) {
        setEarnings(earningsData.earnings);
        setBreakdown(earningsData.breakdown);
        setTransactions(earningsData.transactions);
        setStats(earningsData.stats);
      }

      // Cargar estado de Stripe
      const stripeRes = await apiRequest("GET", "/api/admin/finance/stripe-status");
      const stripeData = await stripeRes.json();
      
      if (stripeData.success) {
        setStripeStatus(stripeData.status);
      }

      // Cargar top negocios
      const topRes = await apiRequest("GET", "/api/admin/finance/top-businesses");
      const topData = await topRes.json();
      
      if (topData.success) {
        setTopBusinesses(topData.topBusinesses);
      }
    } catch (error) {
      console.error("Error loading finance data:", error);
      showToast("Error al cargar datos financieros", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      showToast("Exportando transacciones...", "info");
      const res = await apiRequest("POST", "/api/admin/finance/export-csv", {});
      showToast("CSV exportado correctamente", "success");
    } catch (error) {
      showToast("Error al exportar CSV", "error");
    }
  };

  const handleReconnectStripe = () => {
    Alert.alert(
      "Reconectar Stripe",
      "Esta función abrirá el dashboard de Stripe para verificar la conexión.",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Abrir Stripe", onPress: () => showToast("Abriendo Stripe Dashboard...", "info") },
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={RabbitFoodColors.primary} />
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Cargando datos financieros...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Stripe Connect Status */}
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <View style={styles.cardHeader}>
          <Feather name="credit-card" size={24} color={RabbitFoodColors.primary} />
          <Text style={[styles.cardTitle, { color: theme.text }]}>Cuenta Stripe Connect</Text>
        </View>
        
        {stripeStatus && (
          <>
            <View style={styles.statusRow}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Estado:</Text>
              <View style={styles.statusBadge}>
                <View style={[styles.statusDot, { backgroundColor: stripeStatus.isConnected ? RabbitFoodColors.success : RabbitFoodColors.error }]} />
                <Text style={[styles.statusText, { color: stripeStatus.isConnected ? RabbitFoodColors.success : RabbitFoodColors.error }]}>
                  {stripeStatus.isConnected ? "Conectada" : "Desconectada"}
                </Text>
              </View>
            </View>

            {stripeStatus.accountId && (
              <View style={styles.statusRow}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Account ID:</Text>
                <Text style={[styles.value, { color: theme.text }]}>{stripeStatus.accountId}</Text>
              </View>
            )}

            <View style={styles.statusRow}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Pagos habilitados:</Text>
              <Text style={[styles.value, { color: theme.text }]}>{stripeStatus.chargesEnabled ? "Sí" : "No"}</Text>
            </View>

            {stripeStatus.lastSync && (
              <View style={styles.statusRow}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Última sincronización:</Text>
                <Text style={[styles.value, { color: theme.text }]}>
                  {new Date(stripeStatus.lastSync).toLocaleString("es-VE")}
                </Text>
              </View>
            )}

            {stripeStatus.error && (
              <View style={[styles.alert, { backgroundColor: RabbitFoodColors.error + "20" }]}>
                <Feather name="alert-circle" size={16} color={RabbitFoodColors.error} />
                <Text style={[styles.alertText, { color: RabbitFoodColors.error }]}>{stripeStatus.error}</Text>
              </View>
            )}

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.button, styles.buttonSecondary, { borderColor: theme.border }]}
                onPress={handleReconnectStripe}
              >
                <Feather name="refresh-cw" size={16} color={RabbitFoodColors.primary} />
                <Text style={[styles.buttonText, { color: RabbitFoodColors.primary }]}>Reconectar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.buttonPrimary, { backgroundColor: RabbitFoodColors.primary }]}
                onPress={() => showToast("Abriendo Stripe...", "info")}
              >
                <Feather name="external-link" size={16} color="#FFF" />
                <Text style={[styles.buttonText, { color: "#FFF" }]}>Ver en Stripe</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      {/* Ganancias Netas */}
      {earnings && (
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <View style={styles.cardHeader}>
            <Feather name="dollar-sign" size={24} color={RabbitFoodColors.success} />
            <Text style={[styles.cardTitle, { color: theme.text }]}>Ganancias Netas de la Plataforma</Text>
          </View>

          <View style={styles.earningsGrid}>
            <View style={styles.earningItem}>
              <Text style={[styles.earningLabel, { color: theme.textSecondary }]}>Hoy</Text>
              <Text style={[styles.earningValue, { color: RabbitFoodColors.success }]}>
                ${(earnings.today / 100).toFixed(2)}
              </Text>
            </View>
            <View style={styles.earningItem}>
              <Text style={[styles.earningLabel, { color: theme.textSecondary }]}>Esta semana</Text>
              <Text style={[styles.earningValue, { color: RabbitFoodColors.success }]}>
                ${(earnings.week / 100).toFixed(2)}
              </Text>
            </View>
            <View style={styles.earningItem}>
              <Text style={[styles.earningLabel, { color: theme.textSecondary }]}>Este mes</Text>
              <Text style={[styles.earningValue, { color: RabbitFoodColors.success }]}>
                ${(earnings.month / 100).toFixed(2)}
              </Text>
            </View>
            <View style={styles.earningItem}>
              <Text style={[styles.earningLabel, { color: theme.textSecondary }]}>Total</Text>
              <Text style={[styles.earningValue, { color: RabbitFoodColors.primary }]}>
                ${(earnings.total / 100).toFixed(2)}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Desglose de Comisiones */}
      {breakdown && (
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <View style={styles.cardHeader}>
            <Feather name="pie-chart" size={24} color={RabbitFoodColors.primary} />
            <Text style={[styles.cardTitle, { color: theme.text }]}>Desglose por Tipo</Text>
          </View>

          <View style={styles.breakdownList}>
            <View style={styles.breakdownItem}>
              <Text style={[styles.breakdownLabel, { color: theme.text }]}>• Markup productos (15%)</Text>
              <Text style={[styles.breakdownValue, { color: RabbitFoodColors.success }]}>
                ${(breakdown.productMarkup / 100).toFixed(2)}
              </Text>
            </View>
            <View style={styles.breakdownItem}>
              <Text style={[styles.breakdownLabel, { color: theme.text }]}>• Comisión delivery (0%)</Text>
              <Text style={[styles.breakdownValue, { color: theme.textSecondary }]}>
                ${(breakdown.deliveryCommission / 100).toFixed(2)}
              </Text>
            </View>
            <View style={styles.breakdownItem}>
              <Text style={[styles.breakdownLabel, { color: theme.text }]}>• Comisión negocios (0%)</Text>
              <Text style={[styles.breakdownValue, { color: theme.textSecondary }]}>
                ${(breakdown.businessCommission / 100).toFixed(2)}
              </Text>
            </View>
            <View style={styles.breakdownItem}>
              <Text style={[styles.breakdownLabel, { color: theme.text }]}>• Penalizaciones</Text>
              <Text style={[styles.breakdownValue, { color: RabbitFoodColors.warning }]}>
                ${(breakdown.penalties / 100).toFixed(2)}
              </Text>
            </View>
            <View style={styles.breakdownItem}>
              <Text style={[styles.breakdownLabel, { color: theme.text }]}>• Cupones aplicados</Text>
              <Text style={[styles.breakdownValue, { color: RabbitFoodColors.error }]}>
                -${(Math.abs(breakdown.couponsApplied) / 100).toFixed(2)}
              </Text>
            </View>
            <View style={[styles.breakdownItem, styles.breakdownTotal, { borderTopColor: theme.border }]}>
              <Text style={[styles.breakdownLabel, { color: theme.text, fontWeight: "700" }]}>TOTAL NETO</Text>
              <Text style={[styles.breakdownValue, { color: RabbitFoodColors.primary, fontWeight: "700", fontSize: 18 }]}>
                ${(breakdown.netTotal / 100).toFixed(2)}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Estadísticas */}
      {stats && (
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <View style={styles.cardHeader}>
            <Feather name="bar-chart-2" size={24} color={RabbitFoodColors.primary} />
            <Text style={[styles.cardTitle, { color: theme.text }]}>Estadísticas</Text>
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.text }]}>{stats.totalOrders}</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Pedidos entregados</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.text }]}>${(stats.avgCommissionPerOrder / 100).toFixed(2)}</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Comisión promedio</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.text }]}>{stats.conversionRate}%</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Tasa de conversión</Text>
            </View>
          </View>
        </View>
      )}

      {/* Top Negocios */}
      {topBusinesses.length > 0 && (
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <View style={styles.cardHeader}>
            <Feather name="trending-up" size={24} color={RabbitFoodColors.primary} />
            <Text style={[styles.cardTitle, { color: theme.text }]}>Top Negocios Generadores</Text>
          </View>

          {topBusinesses.slice(0, 5).map((business, index) => (
            <View key={business.businessId} style={[styles.topBusinessItem, { borderBottomColor: theme.border }]}>
              <View style={styles.topBusinessRank}>
                <Text style={[styles.rankNumber, { color: index < 3 ? RabbitFoodColors.primary : theme.textSecondary }]}>
                  #{index + 1}
                </Text>
              </View>
              <View style={styles.topBusinessInfo}>
                <Text style={[styles.topBusinessName, { color: theme.text }]}>{business.businessName}</Text>
                <Text style={[styles.topBusinessOrders, { color: theme.textSecondary }]}>
                  {business.totalOrders} pedidos
                </Text>
              </View>
              <Text style={[styles.topBusinessEarnings, { color: RabbitFoodColors.success }]}>
                ${(business.totalCommissions / 100).toFixed(2)}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Historial de Transacciones */}
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <View style={styles.cardHeader}>
          <Feather name="list" size={24} color={RabbitFoodColors.primary} />
          <Text style={[styles.cardTitle, { color: theme.text }]}>Historial de Comisiones</Text>
        </View>

        <TouchableOpacity
          style={[styles.exportButton, { backgroundColor: RabbitFoodColors.primary }]}
          onPress={handleExportCSV}
        >
          <Feather name="download" size={16} color="#FFF" />
          <Text style={styles.exportButtonText}>Exportar CSV</Text>
        </TouchableOpacity>

        {transactions.slice(0, 10).map((tx) => (
          <View key={tx.id} style={[styles.transactionItem, { borderBottomColor: theme.border }]}>
            <View style={styles.transactionLeft}>
              <Text style={[styles.transactionDate, { color: theme.textSecondary }]}>
                {new Date(tx.date).toLocaleDateString("es-VE")}
              </Text>
              <Text style={[styles.transactionBusiness, { color: theme.text }]}>{tx.businessName}</Text>
              <Text style={[styles.transactionOrder, { color: theme.textSecondary }]}>
                Pedido #{tx.orderId.slice(0, 8)}
              </Text>
            </View>
            <Text style={[styles.transactionAmount, { color: RabbitFoodColors.success }]}>
              +${(tx.amount / 100).toFixed(2)}
            </Text>
          </View>
        ))}

        {transactions.length === 0 && (
          <View style={styles.emptyState}>
            <Feather name="inbox" size={48} color={theme.textSecondary} />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              No hay transacciones registradas
            </Text>
          </View>
        )}
      </View>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
  },
  value: {
    fontSize: 14,
    fontWeight: "600",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 14,
    fontWeight: "600",
  },
  alert: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  alertText: {
    fontSize: 12,
    flex: 1,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  button: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 12,
    borderRadius: 8,
  },
  buttonSecondary: {
    borderWidth: 1,
  },
  buttonPrimary: {},
  buttonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  earningsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  earningItem: {
    flex: 1,
    minWidth: "45%",
    alignItems: "center",
    padding: 12,
  },
  earningLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  earningValue: {
    fontSize: 24,
    fontWeight: "700",
  },
  breakdownList: {
    gap: 12,
  },
  breakdownItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  breakdownLabel: {
    fontSize: 14,
  },
  breakdownValue: {
    fontSize: 16,
    fontWeight: "600",
  },
  breakdownTotal: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  statsGrid: {
    flexDirection: "row",
    gap: 12,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    textAlign: "center",
  },
  topBusinessItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  topBusinessRank: {
    width: 40,
    alignItems: "center",
  },
  rankNumber: {
    fontSize: 18,
    fontWeight: "700",
  },
  topBusinessInfo: {
    flex: 1,
    marginLeft: 12,
  },
  topBusinessName: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 2,
  },
  topBusinessOrders: {
    fontSize: 12,
  },
  topBusinessEarnings: {
    fontSize: 16,
    fontWeight: "700",
  },
  exportButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  exportButtonText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "600",
  },
  transactionItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  transactionLeft: {
    flex: 1,
  },
  transactionDate: {
    fontSize: 12,
    marginBottom: 2,
  },
  transactionBusiness: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 2,
  },
  transactionOrder: {
    fontSize: 12,
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: "700",
  },
  emptyState: {
    alignItems: "center",
    padding: 32,
  },
  emptyText: {
    fontSize: 14,
    marginTop: 12,
  },
});
