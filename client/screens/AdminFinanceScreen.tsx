import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, Dimensions } from 'react-native';
import { Colors } from '../constants/Colors';
import { useAuth } from '../contexts/AuthContext';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';

const screenWidth = Dimensions.get('window').width;

interface FinanceMetrics {
  totalRevenue: number;
  monthlyRevenue: number;
  dailyRevenue: number;
  revenueGrowth: number;
  platformCommissions: number;
  businessPayouts: number;
  driverPayouts: number;
  pendingPayouts: number;
  totalTransactions: number;
  successfulPayments: number;
  failedPayments: number;
  refunds: number;
  stripeFeesTotal: number;
  twilioFeesTotal: number;
  operatingCosts: number;
  netProfit: number;
  averageOrderValue: number;
  totalOrders: number;
  activeBusinesses: number;
  activeDrivers: number;
}

interface BalanceSheet {
  assets: {
    cash: number;
    pendingReceivables: number;
    stripeBalance: number;
    total: number;
  };
  liabilities: {
    pendingPayouts: number;
    refundsOwed: number;
    operatingExpenses: number;
    total: number;
  };
  equity: {
    retainedEarnings: number;
    currentPeriodEarnings: number;
    total: number;
  };
}

interface CashFlowData {
  date: string;
  income: number;
  expenses: number;
  netFlow: number;
}

export default function AdminFinanceScreen() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'balance' | 'cashflow' | 'reports'>('overview');
  const [metrics, setMetrics] = useState<FinanceMetrics | null>(null);
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheet | null>(null);
  const [cashFlowData, setCashFlowData] = useState<CashFlowData[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month' | 'year'>('month');

  useEffect(() => {
    loadFinanceData();
  }, [timeRange]);

  const loadFinanceData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadMetrics(),
        loadBalanceSheet(),
        loadCashFlow(),
      ]);
    } catch (error) {
      console.error('Error loading finance data:', error);
      Alert.alert('Error', 'No se pudieron cargar los datos financieros');
    } finally {
      setLoading(false);
    }
  };

  const loadMetrics = async () => {
    const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/admin/finance/metrics?range=${timeRange}`, {
      headers: { 'Authorization': `Bearer ${user?.token}` },
    });
    if (response.ok) {
      const data = await response.json();
      setMetrics(data.metrics);
    }
  };

  const loadBalanceSheet = async () => {
    const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/admin/finance/balance-sheet`, {
      headers: { 'Authorization': `Bearer ${user?.token}` },
    });
    if (response.ok) {
      const data = await response.json();
      setBalanceSheet(data.data);
    }
  };

  const loadCashFlow = async () => {
    const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/admin/finance/cashflow`, {
      headers: { 'Authorization': `Bearer ${user?.token}` },
    });
    if (response.ok) {
      const data = await response.json();
      setCashFlowData(data.data);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-VE', {
      style: 'currency',
      currency: 'MXN',
    }).format(amount / 100);
  };

  const renderOverview = () => (
    <ScrollView>
      {/* Time Range Selector */}
      <View style={styles.timeRangeContainer}>
        {(['today', 'week', 'month', 'year'] as const).map((range) => (
          <TouchableOpacity
            key={range}
            style={[styles.timeRangeButton, timeRange === range && styles.timeRangeButtonActive]}
            onPress={() => setTimeRange(range)}
          >
            <Text style={[styles.timeRangeText, timeRange === range && styles.timeRangeTextActive]}>
              {range === 'today' ? 'Hoy' : range === 'week' ? 'Semana' : range === 'month' ? 'Mes' : 'Año'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Key Metrics */}
      <View style={styles.metricsGrid}>
        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>{formatCurrency(metrics?.totalRevenue || 0)}</Text>
          <Text style={styles.metricLabel}>Ingresos Totales</Text>
          <Text style={[styles.metricChange, { color: 'green' }]}>+{metrics?.revenueGrowth || 0}%</Text>
        </View>
        
        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>{formatCurrency(metrics?.platformCommissions || 0)}</Text>
          <Text style={styles.metricLabel}>Comisiones Plataforma</Text>
          <Text style={styles.metricSubtext}>15% del total</Text>
        </View>
        
        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>{formatCurrency(metrics?.netProfit || 0)}</Text>
          <Text style={styles.metricLabel}>Ganancia Neta</Text>
          <Text style={[styles.metricChange, { color: metrics?.netProfit && metrics.netProfit > 0 ? 'green' : 'red' }]}>
            {metrics?.netProfit && metrics.netProfit > 0 ? '+' : ''}{((metrics?.netProfit || 0) / (metrics?.totalRevenue || 1) * 100).toFixed(1)}%
          </Text>
        </View>
        
        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>{metrics?.totalOrders || 0}</Text>
          <Text style={styles.metricLabel}>Pedidos Totales</Text>
          <Text style={styles.metricSubtext}>{formatCurrency(metrics?.averageOrderValue || 0)} promedio</Text>
        </View>
      </View>

      {/* Revenue Distribution */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Distribución de Ingresos</Text>
        {metrics && (
          <PieChart
            data={[
              { name: 'Plataforma', population: metrics.platformCommissions, color: Colors.light.tint, legendFontColor: '#7F7F7F' },
              { name: 'Negocios', population: metrics.businessPayouts, color: '#4CAF50', legendFontColor: '#7F7F7F' },
              { name: 'Repartidores', population: metrics.driverPayouts, color: '#FF9800', legendFontColor: '#7F7F7F' },
            ]}
            width={screenWidth - 40}
            height={220}
            chartConfig={{
              color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
            }}
            accessor="population"
            backgroundColor="transparent"
            paddingLeft="15"
            absolute
          />
        )}
      </View>

      {/* Payment Analytics */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Análisis de Pagos</Text>
        <View style={styles.paymentStats}>
          <View style={styles.paymentStat}>
            <Text style={styles.paymentStatValue}>{metrics?.successfulPayments || 0}</Text>
            <Text style={styles.paymentStatLabel}>Exitosos</Text>
          </View>
          <View style={styles.paymentStat}>
            <Text style={[styles.paymentStatValue, { color: 'red' }]}>{metrics?.failedPayments || 0}</Text>
            <Text style={styles.paymentStatLabel}>Fallidos</Text>
          </View>
          <View style={styles.paymentStat}>
            <Text style={styles.paymentStatValue}>{formatCurrency(metrics?.refunds || 0)}</Text>
            <Text style={styles.paymentStatLabel}>Reembolsos</Text>
          </View>
        </View>
      </View>

      {/* Operating Costs */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Costos Operativos</Text>
        <View style={styles.costBreakdown}>
          <View style={styles.costItem}>
            <Text style={styles.costLabel}>Tarifas Stripe</Text>
            <Text style={styles.costValue}>{formatCurrency(metrics?.stripeFeesTotal || 0)}</Text>
          </View>
          <View style={styles.costItem}>
            <Text style={styles.costLabel}>SMS Twilio</Text>
            <Text style={styles.costValue}>{formatCurrency(metrics?.twilioFeesTotal || 0)}</Text>
          </View>
          <View style={styles.costItem}>
            <Text style={styles.costLabel}>Gastos Operativos</Text>
            <Text style={styles.costValue}>{formatCurrency(metrics?.operatingCosts || 0)}</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );

  const renderBalanceSheet = () => (
    <ScrollView>
      <Text style={styles.sectionTitle}>Balance General</Text>
      
      {/* Assets */}
      <View style={styles.section}>
        <Text style={styles.subsectionTitle}>Activos</Text>
        <View style={styles.balanceItem}>
          <Text style={styles.balanceLabel}>Efectivo</Text>
          <Text style={styles.balanceValue}>{formatCurrency(balanceSheet?.assets.cash || 0)}</Text>
        </View>
        <View style={styles.balanceItem}>
          <Text style={styles.balanceLabel}>Cuentas por Cobrar</Text>
          <Text style={styles.balanceValue}>{formatCurrency(balanceSheet?.assets.pendingReceivables || 0)}</Text>
        </View>
        <View style={styles.balanceItem}>
          <Text style={styles.balanceLabel}>Balance Stripe</Text>
          <Text style={styles.balanceValue}>{formatCurrency(balanceSheet?.assets.stripeBalance || 0)}</Text>
        </View>
        <View style={[styles.balanceItem, styles.balanceTotal]}>
          <Text style={styles.balanceTotalLabel}>Total Activos</Text>
          <Text style={styles.balanceTotalValue}>{formatCurrency(balanceSheet?.assets.total || 0)}</Text>
        </View>
      </View>

      {/* Liabilities */}
      <View style={styles.section}>
        <Text style={styles.subsectionTitle}>Pasivos</Text>
        <View style={styles.balanceItem}>
          <Text style={styles.balanceLabel}>Pagos Pendientes</Text>
          <Text style={styles.balanceValue}>{formatCurrency(balanceSheet?.liabilities.pendingPayouts || 0)}</Text>
        </View>
        <View style={styles.balanceItem}>
          <Text style={styles.balanceLabel}>Reembolsos Pendientes</Text>
          <Text style={styles.balanceValue}>{formatCurrency(balanceSheet?.liabilities.refundsOwed || 0)}</Text>
        </View>
        <View style={styles.balanceItem}>
          <Text style={styles.balanceLabel}>Gastos Operativos</Text>
          <Text style={styles.balanceValue}>{formatCurrency(balanceSheet?.liabilities.operatingExpenses || 0)}</Text>
        </View>
        <View style={[styles.balanceItem, styles.balanceTotal]}>
          <Text style={styles.balanceTotalLabel}>Total Pasivos</Text>
          <Text style={styles.balanceTotalValue}>{formatCurrency(balanceSheet?.liabilities.total || 0)}</Text>
        </View>
      </View>

      {/* Equity */}
      <View style={styles.section}>
        <Text style={styles.subsectionTitle}>Patrimonio</Text>
        <View style={styles.balanceItem}>
          <Text style={styles.balanceLabel}>Ganancias Retenidas</Text>
          <Text style={styles.balanceValue}>{formatCurrency(balanceSheet?.equity.retainedEarnings || 0)}</Text>
        </View>
        <View style={styles.balanceItem}>
          <Text style={styles.balanceLabel}>Ganancias Período Actual</Text>
          <Text style={styles.balanceValue}>{formatCurrency(balanceSheet?.equity.currentPeriodEarnings || 0)}</Text>
        </View>
        <View style={[styles.balanceItem, styles.balanceTotal]}>
          <Text style={styles.balanceTotalLabel}>Total Patrimonio</Text>
          <Text style={styles.balanceTotalValue}>{formatCurrency(balanceSheet?.equity.total || 0)}</Text>
        </View>
      </View>
    </ScrollView>
  );

  const renderCashFlow = () => (
    <ScrollView>
      <Text style={styles.sectionTitle}>Flujo de Caja (Últimos 30 días)</Text>
      
      {cashFlowData.length > 0 && (
        <LineChart
          data={{
            labels: cashFlowData.slice(-7).map(d => d.date.split('-')[2]),
            datasets: [
              {
                data: cashFlowData.slice(-7).map(d => d.income / 100),
                color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`,
                strokeWidth: 2,
              },
              {
                data: cashFlowData.slice(-7).map(d => d.expenses / 100),
                color: (opacity = 1) => `rgba(244, 67, 54, ${opacity})`,
                strokeWidth: 2,
              },
            ],
            legend: ['Ingresos', 'Gastos'],
          }}
          width={screenWidth - 40}
          height={220}
          chartConfig={{
            backgroundColor: '#ffffff',
            backgroundGradientFrom: '#ffffff',
            backgroundGradientTo: '#ffffff',
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
            labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
            style: { borderRadius: 16 },
            propsForDots: { r: '6', strokeWidth: '2', stroke: '#ffa726' },
          }}
          bezier
          style={{ marginVertical: 8, borderRadius: 16 }}
        />
      )}

      {/* Cash Flow Summary */}
      <View style={styles.section}>
        <Text style={styles.subsectionTitle}>Resumen del Período</Text>
        {cashFlowData.length > 0 && (
          <>
            <View style={styles.cashFlowSummary}>
              <Text style={styles.cashFlowLabel}>Total Ingresos:</Text>
              <Text style={[styles.cashFlowValue, { color: 'green' }]}>
                {formatCurrency(cashFlowData.reduce((sum, d) => sum + d.income, 0))}
              </Text>
            </View>
            <View style={styles.cashFlowSummary}>
              <Text style={styles.cashFlowLabel}>Total Gastos:</Text>
              <Text style={[styles.cashFlowValue, { color: 'red' }]}>
                {formatCurrency(cashFlowData.reduce((sum, d) => sum + d.expenses, 0))}
              </Text>
            </View>
            <View style={styles.cashFlowSummary}>
              <Text style={styles.cashFlowLabel}>Flujo Neto:</Text>
              <Text style={[styles.cashFlowValue, { 
                color: cashFlowData.reduce((sum, d) => sum + d.netFlow, 0) > 0 ? 'green' : 'red' 
              }]}>
                {formatCurrency(cashFlowData.reduce((sum, d) => sum + d.netFlow, 0))}
              </Text>
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Cargando datos financieros...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Módulo Financiero</Text>
      
      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        {[
          { key: 'overview', label: 'Resumen' },
          { key: 'balance', label: 'Balance' },
          { key: 'cashflow', label: 'Flujo' },
          { key: 'reports', label: 'Reportes' },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.activeTab]}
            onPress={() => setActiveTab(tab.key as any)}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab Content */}
      <View style={styles.tabContent}>
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'balance' && renderBalanceSheet()}
        {activeTab === 'cashflow' && renderCashFlow()}
        {activeTab === 'reports' && (
          <View style={styles.comingSoon}>
            <Text style={styles.comingSoonText}>Reportes Avanzados</Text>
            <Text style={styles.comingSoonSubtext}>Próximamente disponible</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.light.text,
    textAlign: 'center',
    paddingVertical: 20,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: Colors.light.tint,
  },
  tabText: {
    fontSize: 14,
    color: Colors.light.tabIconDefault,
    fontWeight: '500',
  },
  activeTabText: {
    color: 'white',
    fontWeight: '600',
  },
  tabContent: {
    flex: 1,
    padding: 20,
  },
  timeRangeContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 4,
  },
  timeRangeButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  timeRangeButtonActive: {
    backgroundColor: Colors.light.tint,
  },
  timeRangeText: {
    fontSize: 12,
    color: Colors.light.tabIconDefault,
  },
  timeRangeTextActive: {
    color: 'white',
    fontWeight: '600',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  metricCard: {
    width: '48%',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.light.text,
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 12,
    color: Colors.light.tabIconDefault,
    marginBottom: 4,
  },
  metricChange: {
    fontSize: 12,
    fontWeight: '600',
  },
  metricSubtext: {
    fontSize: 10,
    color: Colors.light.tabIconDefault,
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 16,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 12,
  },
  paymentStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  paymentStat: {
    alignItems: 'center',
  },
  paymentStatValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.light.tint,
  },
  paymentStatLabel: {
    fontSize: 12,
    color: Colors.light.tabIconDefault,
    marginTop: 4,
  },
  costBreakdown: {
    gap: 12,
  },
  costItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  costLabel: {
    fontSize: 14,
    color: Colors.light.text,
  },
  costValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
  },
  balanceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  balanceTotal: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.light.tint,
    marginTop: 8,
  },
  balanceLabel: {
    fontSize: 14,
    color: Colors.light.text,
  },
  balanceValue: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.light.text,
  },
  balanceTotalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
  },
  balanceTotalValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.light.tint,
  },
  cashFlowSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  cashFlowLabel: {
    fontSize: 14,
    color: Colors.light.text,
  },
  cashFlowValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  comingSoon: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  comingSoonText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 8,
  },
  comingSoonSubtext: {
    fontSize: 14,
    color: Colors.light.tabIconDefault,
  },
  loadingText: {
    fontSize: 18,
    color: Colors.light.text,
    textAlign: 'center',
    marginTop: 50,
  },
});