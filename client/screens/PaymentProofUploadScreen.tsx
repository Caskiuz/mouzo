// Payment Proof Upload Screen
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../hooks/useTheme';
import { getApiUrl, apiRequest } from '../lib/query-client';

interface Props {
  route: {
    params: {
      orderId: string;
      orderTotal: number;
      paymentMethod: {
        provider: string;
        displayName: string;
        instructions: string;
      };
    };
  };
  navigation: any;
}

export default function PaymentProofUploadScreen({ route, navigation }: Props) {
  const { orderId, orderTotal, paymentMethod } = route.params;
  const { theme } = useTheme();
  const [referenceNumber, setReferenceNumber] = useState('');
  const [proofImage, setProofImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [receivingAccounts, setReceivingAccounts] = useState<any>(null);
  const [exchangeRate, setExchangeRate] = useState(36.50);

  const onBack = () => navigation.goBack();
  const onSuccess = () => navigation.navigate('OrderTracking', { orderId });

  useEffect(() => {
    loadReceivingAccounts();
    loadExchangeRate();
  }, []);

  const loadReceivingAccounts = async () => {
    try {
      const response = await apiRequest('GET', '/api/payment-accounts/receiving-accounts');
      const data = await response.json();
      if (data.success) {
        setReceivingAccounts(data.accounts);
      }
    } catch (error) {
      console.error('Error loading receiving accounts:', error);
    }
  };

  const loadExchangeRate = async () => {
    try {
      const response = await apiRequest('GET', '/api/system/exchange-rate');
      const data = await response.json();
      if (data.rate) {
        setExchangeRate(data.rate);
      }
    } catch (error) {
      console.log('Using default exchange rate:', exchangeRate);
    }
  };

  // Validación de props requeridos
  if (!paymentMethod) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { backgroundColor: theme.card }]}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Error</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Ionicons name="alert-circle" size={64} color={theme.error} />
          <Text style={[styles.headerTitle, { color: theme.text, marginTop: 16, textAlign: 'center' }]}>
            Método de pago no seleccionado
          </Text>
          <TouchableOpacity
            style={[styles.submitButton, { backgroundColor: theme.primary, marginTop: 24 }]}
            onPress={onBack}
          >
            <Text style={styles.submitButtonText}>Volver</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert(
        'Permiso Requerido',
        'Necesitamos acceso a tu galería para subir el comprobante.'
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      setProofImage(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert(
        'Permiso Requerido',
        'Necesitamos acceso a tu cámara para tomar una foto del comprobante.'
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      setProofImage(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    if (!referenceNumber.trim()) {
      Alert.alert('Error', 'Por favor ingresa el número de referencia');
      return;
    }

    if (!proofImage) {
      Alert.alert('Error', 'Por favor sube una foto del comprobante');
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      
      // Convert image to blob for web compatibility
      const response = await fetch(proofImage);
      const blob = await response.blob();
      const filename = `proof-${Date.now()}.jpg`;
      formData.append('proof', blob, filename);
      
      formData.append('orderId', orderId);
      formData.append('paymentProvider', paymentMethod.provider);
      formData.append('referenceNumber', referenceNumber.trim());
      formData.append('amount', orderTotal.toString());

      // Get token
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const token = await AsyncStorage.getItem('token');

      const submitResponse = await fetch(
        `${getApiUrl()}/api/digital-payments/proof/submit`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: formData,
        }
      );

      console.log('📤 Submit response status:', submitResponse.status);
      const data = await submitResponse.json();
      console.log('📤 Submit response data:', data);

      setUploading(false);

      if (submitResponse.ok && data.success) {
        console.log('✅ Success! Navigating to confirmation...');
        const regretPeriodEndsAt = new Date(Date.now() + 60000).toISOString();
        navigation.replace('OrderConfirmation', { orderId, regretPeriodEndsAt });
        return;
      } else {
        throw new Error(data.message || data.error || 'Error al enviar comprobante');
      }
    } catch (error: any) {
      console.error('❌ Error submitting:', error);
      Alert.alert('Error', error.message || 'No se pudo enviar el comprobante');
      setUploading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.card }]}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          Subir Comprobante
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Payment Method Info */}
        <View style={[styles.infoCard, { backgroundColor: theme.card }]}>
          <View style={styles.infoRow}>
            <Ionicons name="card-outline" size={20} color={theme.primary} />
            <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>
              Método de Pago
            </Text>
          </View>
          <Text style={[styles.infoValue, { color: theme.text }]}>
            {paymentMethod.displayName}
          </Text>
        </View>

        <View style={[styles.infoCard, { backgroundColor: theme.card }]}>
          <View style={styles.infoRow}>
            <Ionicons name="cash-outline" size={20} color={theme.primary} />
            <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>
              Monto Total
            </Text>
          </View>
          <Text style={[styles.infoValue, { color: theme.primary, fontSize: 24 }]}>
            {orderTotal.toFixed(2)} Bs
          </Text>
        </View>

        {/* Instructions */}
        <View style={[styles.instructionsCard, { backgroundColor: '#FF950020' }]}>
          <View style={styles.instructionsHeader}>
            <Ionicons name="information-circle" size={20} color="#FF9500" />
            <Text style={styles.instructionsTitle}>Instrucciones de Pago</Text>
          </View>
          <Text style={styles.instructionsText}>
            {paymentMethod.instructions}
          </Text>
          
          {/* Datos de la cuenta receptora */}
          <View style={[styles.accountDataCard, { backgroundColor: theme.card, marginTop: 12 }]}>
            <Text style={[styles.accountDataTitle, { color: theme.text }]}>
              💸 Enviar pago a:
            </Text>
            
            {paymentMethod.provider === 'binance_pay' && receivingAccounts?.binance_pay && (
              <>
                <View style={styles.accountDataRow}>
                  <Text style={[styles.accountDataLabel, { color: theme.textSecondary }]}>Binance ID:</Text>
                  <Text style={[styles.accountDataValue, { color: theme.text }]}>{receivingAccounts.binance_pay.binanceId}</Text>
                </View>
                <View style={styles.accountDataRow}>
                  <Text style={[styles.accountDataLabel, { color: theme.textSecondary }]}>Email:</Text>
                  <Text style={[styles.accountDataValue, { color: theme.text }]}>{receivingAccounts.binance_pay.email}</Text>
                </View>
                <View style={[styles.accountDataRow, { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E5E5E5' }]}>
                  <Text style={[styles.accountDataLabel, { color: theme.textSecondary, fontSize: 15 }]}>Monto a enviar:</Text>
                  <Text style={[styles.accountDataValue, { color: '#00C853', fontWeight: 'bold', fontSize: 18 }]}>
                    ${(orderTotal / exchangeRate).toFixed(2)} USD
                  </Text>
                </View>
              </>
            )}
            
            {paymentMethod.provider === 'zinli' && receivingAccounts?.zinli && (
              <>
                <View style={styles.accountDataRow}>
                  <Text style={[styles.accountDataLabel, { color: theme.textSecondary }]}>Email Zinli:</Text>
                  <Text style={[styles.accountDataValue, { color: theme.text }]}>{receivingAccounts.zinli.email}</Text>
                </View>
                <View style={[styles.accountDataRow, { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E5E5E5' }]}>
                  <Text style={[styles.accountDataLabel, { color: theme.textSecondary, fontSize: 15 }]}>Monto a enviar:</Text>
                  <Text style={[styles.accountDataValue, { color: '#00C853', fontWeight: 'bold', fontSize: 18 }]}>
                    ${(orderTotal / exchangeRate).toFixed(2)} USD
                  </Text>
                </View>
              </>
            )}
            
            {paymentMethod.provider === 'zelle' && receivingAccounts?.zelle && (
              <>
                <View style={styles.accountDataRow}>
                  <Text style={[styles.accountDataLabel, { color: theme.textSecondary }]}>Email Zelle:</Text>
                  <Text style={[styles.accountDataValue, { color: theme.text }]}>{receivingAccounts.zelle.email}</Text>
                </View>
                <View style={styles.accountDataRow}>
                  <Text style={[styles.accountDataLabel, { color: theme.textSecondary }]}>Teléfono:</Text>
                  <Text style={[styles.accountDataValue, { color: theme.text }]}>{receivingAccounts.zelle.phone}</Text>
                </View>
                <View style={[styles.accountDataRow, { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E5E5E5' }]}>
                  <Text style={[styles.accountDataLabel, { color: theme.textSecondary, fontSize: 15 }]}>Monto a enviar:</Text>
                  <Text style={[styles.accountDataValue, { color: '#00C853', fontWeight: 'bold', fontSize: 18 }]}>
                    ${(orderTotal / exchangeRate).toFixed(2)} USD
                  </Text>
                </View>
              </>
            )}
            
            {paymentMethod.provider === 'paypal' && receivingAccounts?.paypal && (
              <>
                <View style={styles.accountDataRow}>
                  <Text style={[styles.accountDataLabel, { color: theme.textSecondary }]}>Email PayPal:</Text>
                  <Text style={[styles.accountDataValue, { color: theme.text }]}>{receivingAccounts.paypal.email}</Text>
                </View>
                <View style={[styles.accountDataRow, { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E5E5E5' }]}>
                  <Text style={[styles.accountDataLabel, { color: theme.textSecondary, fontSize: 15 }]}>Monto a enviar:</Text>
                  <Text style={[styles.accountDataValue, { color: '#00C853', fontWeight: 'bold', fontSize: 18 }]}>
                    ${(orderTotal / exchangeRate).toFixed(2)} USD
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Reference Number Input */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            {paymentMethod.provider === 'binance_pay' ? 'Transaction ID (TxID) *' :
             paymentMethod.provider === 'zinli' ? 'Número de Referencia *' :
             paymentMethod.provider === 'zelle' ? 'Confirmation Number *' :
             paymentMethod.provider === 'paypal' ? 'Transaction ID *' :
             paymentMethod.provider === 'pago_movil' ? 'Número de Referencia *' :
             'ID de Transacción *'}
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.card,
                color: theme.text,
                borderColor: theme.border,
              },
            ]}
            placeholder={
              paymentMethod.provider === 'binance_pay' ? 'Ej: 1a2b3c4d5e6f7g8h9i0j' :
              paymentMethod.provider === 'zinli' ? 'Ej: 12345678' :
              paymentMethod.provider === 'zelle' ? 'Ej: ABC123XYZ456' :
              paymentMethod.provider === 'paypal' ? 'Ej: 1AB23456CD789012E' :
              paymentMethod.provider === 'pago_movil' ? 'Ej: 1234567890' :
              'Ej: TXN123456789'
            }
            placeholderTextColor={theme.textSecondary}
            value={referenceNumber}
            onChangeText={setReferenceNumber}
            keyboardType={(paymentMethod.provider === 'pago_movil' || paymentMethod.provider === 'zinli') ? 'numeric' : 'default'}
            maxLength={
              paymentMethod.provider === 'pago_movil' ? 20 :
              paymentMethod.provider === 'zinli' ? 10 :
              50
            }
          />
        </View>

        {/* Image Upload */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Captura de Pantalla del Pago *
          </Text>

          {proofImage ? (
            <View style={styles.imagePreview}>
              <Image source={{ uri: proofImage }} style={styles.previewImage} />
              <TouchableOpacity
                style={styles.removeImageButton}
                onPress={() => setProofImage(null)}
              >
                <Ionicons name="close-circle" size={32} color="#FF3B30" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.uploadButtons}>
              <TouchableOpacity
                style={[styles.uploadButton, { backgroundColor: theme.card }]}
                onPress={takePhoto}
              >
                <Ionicons name="camera" size={32} color={theme.primary} />
                <Text style={[styles.uploadButtonText, { color: theme.text }]}>
                  Tomar Foto
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.uploadButton, { backgroundColor: theme.card }]}
                onPress={pickImage}
              >
                <Ionicons name="images" size={32} color={theme.primary} />
                <Text style={[styles.uploadButtonText, { color: theme.text }]}>
                  Desde Galería
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Tips */}
        <View style={[styles.tipsCard, { backgroundColor: theme.card }]}>
          <Text style={[styles.tipsTitle, { color: theme.text }]}>
            💡 Consejos para una verificación rápida:
          </Text>
          <Text style={[styles.tipText, { color: theme.textSecondary }]}>
            • Toma captura de pantalla de la transacción completada
          </Text>
          <Text style={[styles.tipText, { color: theme.textSecondary }]}>
            • Asegúrate que se vea el ID de transacción
          </Text>
          <Text style={[styles.tipText, { color: theme.textSecondary }]}>
            • Verifica que el monto en USD coincida
          </Text>
          <Text style={[styles.tipText, { color: theme.textSecondary }]}>
            • La verificación toma entre 5-30 minutos
          </Text>
        </View>
      </ScrollView>

      {/* Submit Button */}
      <View style={[styles.footer, { backgroundColor: theme.card }]}>
        <TouchableOpacity
          style={[
            styles.submitButton,
            {
              backgroundColor:
                referenceNumber && proofImage ? '#E8B4A8' : theme.border,
            },
          ]}
          onPress={handleSubmit}
          disabled={!referenceNumber || !proofImage || uploading}
        >
          {uploading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Text style={styles.submitButtonText}>Enviar Comprobante</Text>
              <Ionicons name="checkmark-circle" size={20} color="#FFF" />
            </>
          )}
        </TouchableOpacity>
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
  content: {
    flex: 1,
    padding: 16,
  },
  infoCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
  },
  infoValue: {
    fontSize: 18,
    fontWeight: '600',
  },
  instructionsCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  instructionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF9500',
  },
  instructionsText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  accountDataCard: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  accountDataTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
  },
  accountDataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  accountDataLabel: {
    fontSize: 13,
  },
  accountDataValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  input: {
    padding: 16,
    borderRadius: 12,
    fontSize: 16,
    borderWidth: 1,
  },
  uploadButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  uploadButton: {
    flex: 1,
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    gap: 8,
  },
  uploadButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  imagePreview: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: 300,
    borderRadius: 12,
  },
  removeImageButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#FFF',
    borderRadius: 16,
  },
  tipsCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  tipText: {
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 4,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
});
