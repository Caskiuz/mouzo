// Payment Proof Upload Screen
import React, { useState } from 'react';
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
import { apiRequest } from '../lib/query-client';

interface Props {
  orderId: string;
  orderTotal: number;
  paymentMethod: {
    provider: string;
    displayName: string;
    instructions: string;
  };
  onSuccess: () => void;
  onBack: () => void;
}

export default function PaymentProofUploadScreen({
  orderId,
  orderTotal,
  paymentMethod,
  onSuccess,
  onBack,
}: Props) {
  const { colors } = useTheme();
  const [referenceNumber, setReferenceNumber] = useState('');
  const [proofImage, setProofImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

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
      // Upload image first (you'll need to implement image upload endpoint)
      const formData = new FormData();
      formData.append('image', {
        uri: proofImage,
        type: 'image/jpeg',
        name: 'payment-proof.jpg',
      } as any);

      const uploadResponse = await fetch(
        `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/upload/payment-proof`,
        {
          method: 'POST',
          body: formData,
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      const uploadData = await uploadResponse.json();

      if (!uploadData.success) {
        throw new Error('Error al subir la imagen');
      }

      // Submit payment proof
      const response = await apiRequest('/digital-payments/proof/submit', {
        method: 'POST',
        body: JSON.stringify({
          orderId,
          paymentProvider: paymentMethod.provider,
          referenceNumber: referenceNumber.trim(),
          amount: Math.round(orderTotal * 100), // Convert to cents
          proofImageUrl: uploadData.imageUrl,
        }),
      });

      if (response.success) {
        Alert.alert(
          '¡Comprobante Enviado!',
          'Tu comprobante será verificado en breve. Te notificaremos cuando sea aprobado.',
          [{ text: 'OK', onPress: onSuccess }]
        );
      } else {
        throw new Error(response.error || 'Error al enviar comprobante');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudo enviar el comprobante');
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card }]}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Subir Comprobante
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Payment Method Info */}
        <View style={[styles.infoCard, { backgroundColor: colors.card }]}>
          <View style={styles.infoRow}>
            <Ionicons name="card-outline" size={20} color={colors.primary} />
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
              Método de Pago
            </Text>
          </View>
          <Text style={[styles.infoValue, { color: colors.text }]}>
            {paymentMethod.displayName}
          </Text>
        </View>

        <View style={[styles.infoCard, { backgroundColor: colors.card }]}>
          <View style={styles.infoRow}>
            <Ionicons name="cash-outline" size={20} color={colors.primary} />
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
              Monto Total
            </Text>
          </View>
          <Text style={[styles.infoValue, { color: colors.primary, fontSize: 24 }]}>
            {orderTotal.toFixed(2)} Bs
          </Text>
        </View>

        {/* Instructions */}
        <View style={[styles.instructionsCard, { backgroundColor: '#FF950020' }]}>
          <View style={styles.instructionsHeader}>
            <Ionicons name="information-circle" size={20} color="#FF9500" />
            <Text style={styles.instructionsTitle}>Instrucciones</Text>
          </View>
          <Text style={styles.instructionsText}>
            {paymentMethod.instructions}
          </Text>
        </View>

        {/* Reference Number Input */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Número de Referencia *
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.card,
                color: colors.text,
                borderColor: colors.border,
              },
            ]}
            placeholder="Ej: 1234567890"
            placeholderTextColor={colors.textSecondary}
            value={referenceNumber}
            onChangeText={setReferenceNumber}
            keyboardType="numeric"
            maxLength={20}
          />
        </View>

        {/* Image Upload */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Comprobante de Pago *
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
                style={[styles.uploadButton, { backgroundColor: colors.card }]}
                onPress={takePhoto}
              >
                <Ionicons name="camera" size={32} color={colors.primary} />
                <Text style={[styles.uploadButtonText, { color: colors.text }]}>
                  Tomar Foto
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.uploadButton, { backgroundColor: colors.card }]}
                onPress={pickImage}
              >
                <Ionicons name="images" size={32} color={colors.primary} />
                <Text style={[styles.uploadButtonText, { color: colors.text }]}>
                  Desde Galería
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Tips */}
        <View style={[styles.tipsCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.tipsTitle, { color: colors.text }]}>
            💡 Consejos para una verificación rápida:
          </Text>
          <Text style={[styles.tipText, { color: colors.textSecondary }]}>
            • Asegúrate que la foto sea clara y legible
          </Text>
          <Text style={[styles.tipText, { color: colors.textSecondary }]}>
            • Incluye el número de referencia completo
          </Text>
          <Text style={[styles.tipText, { color: colors.textSecondary }]}>
            • Verifica que el monto coincida
          </Text>
          <Text style={[styles.tipText, { color: colors.textSecondary }]}>
            • La verificación toma entre 5-30 minutos
          </Text>
        </View>
      </ScrollView>

      {/* Submit Button */}
      <View style={[styles.footer, { backgroundColor: colors.card }]}>
        <TouchableOpacity
          style={[
            styles.submitButton,
            {
              backgroundColor:
                referenceNumber && proofImage ? colors.primary : colors.border,
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
