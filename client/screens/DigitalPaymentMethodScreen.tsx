// Digital Payment Method Selection Screen
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../hooks/useTheme';
import { apiRequest } from '../lib/query-client';

interface PaymentMethod {
  id: string;
  name: string;
  provider: string;
  displayName: string;
  isActive: boolean;
  requiresManualVerification: boolean;
  commissionPercentage: number;
  instructions: string;
}

interface Props {
  route?: {
    params?: {
      orderTotal?: number;
    };
  };
}

export default function DigitalPaymentMethodScreen({ route }: Props) {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [exchangeRate, setExchangeRate] = useState(36.50); // Tasa BsD/USD por defecto
  
  const orderTotal = route?.params?.orderTotal || 0;

  useEffect(() => {
    loadPaymentMethods();
    loadExchangeRate();
  }, []);

  const loadPaymentMethods = async () => {
    try {
      const response = await apiRequest('GET', '/api/digital-payments/methods');
      const data = await response.json();

      if (data.success) {
        console.log('Payment methods loaded:', data.methods);
        setMethods(data.methods);
      }
    } catch (error) {
      console.error('Error loading payment methods:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadExchangeRate = async () => {
    try {
      // Intentar obtener tasa del backend
      const response = await apiRequest('GET', '/api/system/exchange-rate');
      const data = await response.json();
      if (data.rate) {
        setExchangeRate(data.rate);
      }
    } catch (error) {
      console.log('Using default exchange rate:', exchangeRate);
    }
  };

  const getMethodIcon = (provider: string) => {
    const icons: Record<string, string> = {
      pago_movil: 'phone-portrait-outline',
      binance_pay: 'logo-bitcoin',
      paypal: 'logo-paypal',
      zinli: 'card-outline',
      zelle: 'cash-outline',
    };
    return icons[provider] || 'card-outline';
  };

  const getMethodColor = (provider: string) => {
    const colors: Record<string, string> = {
      pago_movil: '#0066CC',
      binance_pay: '#F3BA2F',
      paypal: '#003087',
      zinli: '#00D4FF',
      zelle: '#6D1ED4',
    };
    return colors[provider] || '#666';
  };

  const handleSelectMethod = (method: PaymentMethod) => {
    setSelectedMethod(method);
  };

  const handleContinue = () => {
    if (selectedMethod) {
      navigation.navigate('Checkout', {
        selectedPaymentMethod: selectedMethod,
      });
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.card }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          Método de Pago
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Order Total */}
      <View style={[styles.totalCard, { backgroundColor: theme.card }]}>
        <Text style={[styles.totalLabel, { color: theme.textSecondary }]}>
          Total a Pagar
        </Text>
        <Text style={[styles.totalAmount, { color: theme.primary }]}>
          {orderTotal.toFixed(2)} Bs
        </Text>
        {selectedMethod && ['binance_pay', 'zinli', 'zelle', 'paypal'].includes(selectedMethod.provider) && (
          <Text style={[styles.totalUSD, { color: theme.textSecondary }]}>
            ≈ ${(orderTotal / exchangeRate).toFixed(2)} USD
          </Text>
        )}
      </View>

      {/* Payment Methods */}
      <ScrollView 
        style={styles.methodsList} 
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          Selecciona tu método de pago
        </Text>

        {methods.map((method) => {
          const isSelected = selectedMethod?.id === method.id;
          const methodColor = getMethodColor(method.provider);

          return (
            <TouchableOpacity
              key={method.id}
              style={[
                styles.methodCard,
                {
                  backgroundColor: theme.card,
                  borderColor: isSelected ? methodColor : theme.border,
                  borderWidth: isSelected ? 2 : 1,
                },
              ]}
              onPress={() => handleSelectMethod(method)}
            >
              <View style={styles.methodHeader}>
                <View
                  style={[
                    styles.methodIcon,
                    { backgroundColor: methodColor + '20' },
                  ]}
                >
                  <Ionicons
                    name={getMethodIcon(method.provider) as any}
                    size={28}
                    color={methodColor}
                  />
                </View>

                <View style={styles.methodInfo}>
                  <Text style={[styles.methodName, { color: theme.text }]}>
                    {method.displayName}
                  </Text>
                  <View style={styles.methodDetails}>
                    {method.requiresManualVerification && (
                      <View style={styles.badge}>
                        <Ionicons name="time-outline" size={12} color="#FF9500" />
                        <Text style={styles.badgeText}>Verificación manual</Text>
                      </View>
                    )}
                    {method.commissionPercentage > 0 && (
                      <View style={[styles.badge, { backgroundColor: '#FF3B3020' }]}>
                        <Text style={[styles.badgeText, { color: '#FF3B30' }]}>
                          +{method.commissionPercentage}% comisión
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                <View
                  style={[
                    styles.radioButton,
                    {
                      borderColor: isSelected ? methodColor : theme.border,
                      backgroundColor: isSelected ? methodColor : 'transparent',
                    },
                  ]}
                >
                  {isSelected && (
                    <Ionicons name="checkmark" size={16} color="#FFF" />
                  )}
                </View>
              </View>

              {method.instructions && (
                <Text style={[styles.methodInstructions, { color: theme.textSecondary }]}>
                  {method.instructions}
                </Text>
              )}
              
              {/* Mostrar monto en USD para métodos internacionales */}
              {['binance_pay', 'zinli', 'zelle', 'paypal'].includes(method.provider) && orderTotal > 0 && (
                <View style={[styles.usdBadge, { backgroundColor: theme.backgroundSecondary }]}>
                  <Ionicons name="logo-usd" size={14} color={theme.primary} />
                  <Text style={[styles.usdText, { color: theme.text }]}>
                    ${((orderTotal * (1 + (method.commissionPercentage / 100))) / exchangeRate).toFixed(2)} USD
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Continue Button */}
      <View style={[styles.footer, { backgroundColor: theme.card }]}>
        {selectedMethod ? (
          <TouchableOpacity
            style={[
              styles.continueButton,
              { backgroundColor: '#E8B4A8' },
            ]}
            onPress={handleContinue}
          >
            <Text style={[styles.continueButtonText, { color: '#FFF' }]}>
              Continuar
            </Text>
            <Ionicons name="arrow-forward" size={20} color="#FFF" />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  totalCard: {
    margin: 16,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  totalAmount: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  totalUSD: {
    fontSize: 16,
    marginTop: 4,
  },
  methodsList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  methodCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  methodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  methodIcon: {
    width: 56,
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  methodInfo: {
    flex: 1,
  },
  methodName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  methodDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF950020',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  badgeText: {
    fontSize: 11,
    color: '#FF9500',
    fontWeight: '500',
  },
  radioButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodInstructions: {
    fontSize: 13,
    marginTop: 12,
    lineHeight: 18,
  },
  footer: {
    padding: 16,
    backgroundColor: '#FFF',
    borderTopWidth: 2,
    borderTopColor: '#E5E5E5',
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  usdBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
    gap: 4,
  },
  usdText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
