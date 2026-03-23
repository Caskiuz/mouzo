// Payment Verification Tracking Screen
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { apiRequest } from '../lib/query-client';

interface Props {
  orderId: string;
  onVerified: () => void;
  onRejected: () => void;
  onBack: () => void;
}

export default function PaymentVerificationTrackingScreen({
  orderId,
  onVerified,
  onRejected,
  onBack,
}: Props) {
  const { colors } = useTheme();
  const [proof, setProof] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadProof();
    
    // Poll every 10 seconds
    const interval = setInterval(loadProof, 10000);
    return () => clearInterval(interval);
  }, [orderId]);

  const loadProof = async () => {
    try {
      const response = await apiRequest(`/digital-payments/proof/order/${orderId}`, {
        method: 'GET',
      });

      if (response.success) {
        setProof(response.proof);
        
        // Check status
        if (response.proof.status === 'approved') {
          onVerified();
        } else if (response.proof.status === 'rejected') {
          onRejected();
        }
      }
    } catch (error) {
      console.error('Error loading proof:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadProof();
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'pending':
        return {
          icon: 'time-outline',
          color: '#FF9500',
          title: 'Verificando Pago',
          message: 'Tu comprobante está siendo revisado por nuestro equipo.',
        };
      case 'approved':
        return {
          icon: 'checkmark-circle',
          color: '#34C759',
          title: '¡Pago Verificado!',
          message: 'Tu pago ha sido confirmado. Tu pedido está en proceso.',
        };
      case 'rejected':
        return {
          icon: 'close-circle',
          color: '#FF3B30',
          title: 'Pago Rechazado',
          message: 'No pudimos verificar tu comprobante. Por favor, intenta nuevamente.',
        };
      default:
        return {
          icon: 'help-circle',
          color: '#666',
          title: 'Estado Desconocido',
          message: 'Contacta con soporte para más información.',
        };
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!proof) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.text }]}>
          No se encontró el comprobante
        </Text>
      </View>
    );
  }

  const statusInfo = getStatusInfo(proof.status);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card }]}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Estado del Pago
        </Text>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
          <Ionicons name="refresh" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Status Card */}
        <View style={[styles.statusCard, { backgroundColor: colors.card }]}>
          <View
            style={[
              styles.statusIcon,
              { backgroundColor: statusInfo.color + '20' },
            ]}
          >
            <Ionicons
              name={statusInfo.icon as any}
              size={64}
              color={statusInfo.color}
            />
          </View>

          <Text style={[styles.statusTitle, { color: colors.text }]}>
            {statusInfo.title}
          </Text>

          <Text style={[styles.statusMessage, { color: colors.textSecondary }]}>
            {statusInfo.message}
          </Text>

          {proof.status === 'pending' && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={statusInfo.color} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                Tiempo estimado: 5-30 minutos
              </Text>
            </View>
          )}
        </View>

        {/* Timeline */}
        <View style={[styles.timelineCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.timelineTitle, { color: colors.text }]}>
            Línea de Tiempo
          </Text>

          <View style={styles.timelineItem}>
            <View style={[styles.timelineDot, { backgroundColor: '#34C759' }]} />
            <View style={styles.timelineContent}>
              <Text style={[styles.timelineLabel, { color: colors.text }]}>
                Comprobante Enviado
              </Text>
              <Text style={[styles.timelineTime, { color: colors.textSecondary }]}>
                {new Date(proof.submittedAt).toLocaleString('es-VE', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>
          </View>

          <View style={styles.timelineItem}>
            <View
              style={[
                styles.timelineDot,
                {
                  backgroundColor:
                    proof.status !== 'pending' ? '#34C759' : '#E5E5E5',
                },
              ]}
            />
            <View style={styles.timelineContent}>
              <Text style={[styles.timelineLabel, { color: colors.text }]}>
                {proof.status === 'approved'
                  ? 'Pago Verificado'
                  : proof.status === 'rejected'
                  ? 'Pago Rechazado'
                  : 'En Verificación'}
              </Text>
              {proof.verifiedAt && (
                <Text style={[styles.timelineTime, { color: colors.textSecondary }]}>
                  {new Date(proof.verifiedAt).toLocaleString('es-VE', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              )}
            </View>
          </View>

          {proof.status === 'approved' && (
            <View style={styles.timelineItem}>
              <View style={[styles.timelineDot, { backgroundColor: '#E5E5E5' }]} />
              <View style={styles.timelineContent}>
                <Text style={[styles.timelineLabel, { color: colors.text }]}>
                  Pedido en Preparación
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Payment Details */}
        <View style={[styles.detailsCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.detailsTitle, { color: colors.text }]}>
            Detalles del Pago
          </Text>

          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
              Método de Pago
            </Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>
              {proof.paymentProvider}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
              Referencia
            </Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>
              {proof.referenceNumber}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
              Monto
            </Text>
            <Text style={[styles.detailValue, { color: colors.primary }]}>
              {(proof.amount / 100).toFixed(2)} Bs
            </Text>
          </View>

          {proof.verificationNotes && (
            <View style={styles.notesContainer}>
              <Text style={[styles.notesLabel, { color: colors.textSecondary }]}>
                Notas de Verificación:
              </Text>
              <Text style={[styles.notesText, { color: colors.text }]}>
                {proof.verificationNotes}
              </Text>
            </View>
          )}
        </View>

        {/* Proof Image */}
        {proof.proofImageUrl && (
          <View style={[styles.imageCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.imageTitle, { color: colors.text }]}>
              Comprobante
            </Text>
            <Image
              source={{ uri: proof.proofImageUrl }}
              style={styles.proofImage}
              resizeMode="contain"
            />
          </View>
        )}

        {/* Help Section */}
        <View style={[styles.helpCard, { backgroundColor: '#FF950020' }]}>
          <Ionicons name="help-circle" size={24} color="#FF9500" />
          <Text style={styles.helpText}>
            ¿Necesitas ayuda? Contacta a soporte si tu pago no es verificado en 30
            minutos.
          </Text>
        </View>
      </ScrollView>
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
  refreshButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  statusCard: {
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  statusIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  statusTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  statusMessage: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  loadingContainer: {
    marginTop: 24,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
  },
  timelineCard: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
  },
  timelineTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 20,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
    marginRight: 12,
  },
  timelineContent: {
    flex: 1,
  },
  timelineLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  timelineTime: {
    fontSize: 14,
  },
  detailsCard: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
  },
  detailsTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 14,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  notesContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  notesLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  notesText: {
    fontSize: 14,
    lineHeight: 20,
  },
  imageCard: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
  },
  imageTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  proofImage: {
    width: '100%',
    height: 300,
    borderRadius: 12,
  },
  helpCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    marginBottom: 24,
  },
  helpText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
  },
});
