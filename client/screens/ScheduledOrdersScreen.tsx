import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, Modal, TextInput } from 'react-native';
import { Colors } from '../constants/Colors';
import { useAuth } from '../contexts/AuthContext';
import DateTimePicker from '@react-native-community/datetimepicker';

interface ScheduledOrder {
  id: string;
  scheduledFor: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  restaurant: {
    id: string;
    name: string;
    imageUrl: string;
  };
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    price: number;
  }>;
  total: number;
  deliveryAddress: string;
  specialInstructions?: string;
  isRecurring: boolean;
  recurringPattern?: {
    frequency: 'daily' | 'weekly' | 'monthly';
    days?: string[];
    endDate?: string;
  };
  createdAt: string;
}

interface TimeSlot {
  time: string;
  available: boolean;
  estimatedDelivery: string;
  surge?: boolean;
  discount?: number;
}

export default function ScheduledOrdersScreen() {
  const { user } = useAuth();
  const [scheduledOrders, setScheduledOrders] = useState<ScheduledOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'history' | 'schedule'>('upcoming');
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Schedule form state
  const [scheduleForm, setScheduleForm] = useState({
    restaurantId: '',
    deliveryDate: new Date(),
    deliveryTime: '',
    specialInstructions: '',
    isRecurring: false,
    recurringFrequency: 'weekly' as 'daily' | 'weekly' | 'monthly',
    recurringDays: [] as string[],
    recurringEndDate: new Date(),
  });

  useEffect(() => {
    loadScheduledOrders();
    loadAvailableSlots();
  }, [selectedDate]);

  const loadScheduledOrders = async () => {
    setLoading(true);
    try {
      // Mock data
      const mockOrders: ScheduledOrder[] = [
        {
          id: '1',
          scheduledFor: '2024-01-15T19:30:00Z',
          status: 'confirmed',
          restaurant: {
            id: '1',
            name: 'Tacos El Güero',
            imageUrl: 'https://via.placeholder.com/60x60',
          },
          items: [
            { id: '1', name: 'Tacos de Pastor', quantity: 3, price: 4500 },
            { id: '2', name: 'Agua de Horchata', quantity: 1, price: 2000 },
          ],
          total: 6500,
          deliveryAddress: 'Av. Hidalgo 123, Centro',
          specialInstructions: 'Sin cebolla, extra salsa',
          isRecurring: true,
          recurringPattern: {
            frequency: 'weekly',
            days: ['Viernes'],
            endDate: '2024-03-15',
          },
          createdAt: '2024-01-10T10:00:00Z',
        },
        {
          id: '2',
          scheduledFor: '2024-01-16T13:00:00Z',
          status: 'pending',
          restaurant: {
            id: '2',
            name: 'Pizza Napoli',
            imageUrl: 'https://via.placeholder.com/60x60',
          },
          items: [
            { id: '3', name: 'Pizza Hawaiana Grande', quantity: 1, price: 18000 },
          ],
          total: 18000,
          deliveryAddress: 'Calle Morelos 456, Norte',
          isRecurring: false,
          createdAt: '2024-01-12T15:30:00Z',
        },
        {
          id: '3',
          scheduledFor: '2024-01-12T20:00:00Z',
          status: 'completed',
          restaurant: {
            id: '3',
            name: 'Sushi Zen',
            imageUrl: 'https://via.placeholder.com/60x60',
          },
          items: [
            { id: '4', name: 'Combo Sushi', quantity: 2, price: 25000 },
          ],
          total: 25000,
          deliveryAddress: 'Av. Revolución 789, Sur',
          isRecurring: false,
          createdAt: '2024-01-10T18:00:00Z',
        },
      ];

      setScheduledOrders(mockOrders);
    } catch (error) {
      console.error('Error loading scheduled orders:', error);
      Alert.alert('Error', 'No se pudieron cargar los pedidos programados');
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableSlots = async () => {
    try {
      // Mock available time slots
      const mockSlots: TimeSlot[] = [
        { time: '12:00', available: true, estimatedDelivery: '12:30', discount: 10 },
        { time: '12:30', available: true, estimatedDelivery: '13:00' },
        { time: '13:00', available: true, estimatedDelivery: '13:30' },
        { time: '13:30', available: false, estimatedDelivery: '14:00' },
        { time: '19:00', available: true, estimatedDelivery: '19:30', surge: true },
        { time: '19:30', available: true, estimatedDelivery: '20:00', surge: true },
        { time: '20:00', available: true, estimatedDelivery: '20:30' },
        { time: '20:30', available: true, estimatedDelivery: '21:00' },
      ];

      setAvailableSlots(mockSlots);
    } catch (error) {
      console.error('Error loading time slots:', error);
    }
  };

  const scheduleOrder = async () => {
    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/orders/schedule`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.token}`,
        },
        body: JSON.stringify(scheduleForm),
      });

      if (response.ok) {
        Alert.alert('¡Éxito!', 'Pedido programado correctamente');
        setShowScheduleModal(false);
        loadScheduledOrders();
      } else {
        throw new Error('Error scheduling order');
      }
    } catch (error) {
      console.error('Error scheduling order:', error);
      Alert.alert('Error', 'No se pudo programar el pedido');
    }
  };

  const cancelScheduledOrder = async (orderId: string) => {
    Alert.alert(
      'Cancelar Pedido',
      '¿Estás seguro de que quieres cancelar este pedido programado?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, Cancelar',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/orders/scheduled/${orderId}/cancel`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${user?.token}` },
              });

              if (response.ok) {
                Alert.alert('Cancelado', 'Pedido cancelado exitosamente');
                loadScheduledOrders();
              }
            } catch (error) {
              Alert.alert('Error', 'No se pudo cancelar el pedido');
            }
          },
        },
      ]
    );
  };

  const modifyScheduledOrder = (orderId: string) => {
    Alert.alert(
      'Modificar Pedido',
      'Selecciona qué quieres modificar:',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Cambiar Hora', onPress: () => changeOrderTime(orderId) },
        { text: 'Cambiar Productos', onPress: () => changeOrderItems(orderId) },
        { text: 'Cambiar Dirección', onPress: () => changeOrderAddress(orderId) },
      ]
    );
  };

  const changeOrderTime = (orderId: string) => {
    // Implementation for changing order time
    Alert.alert('Cambiar Hora', 'Funcionalidad en desarrollo');
  };

  const changeOrderItems = (orderId: string) => {
    // Implementation for changing order items
    Alert.alert('Cambiar Productos', 'Funcionalidad en desarrollo');
  };

  const changeOrderAddress = (orderId: string) => {
    // Implementation for changing delivery address
    Alert.alert('Cambiar Dirección', 'Funcionalidad en desarrollo');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-VE', {
      style: 'currency',
      currency: 'MXN',
    }).format(amount / 100);
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('es-VE', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }),
      time: date.toLocaleTimeString('es-VE', { 
        hour: '2-digit', 
        minute: '2-digit' 
      }),
    };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'green';
      case 'pending': return 'orange';
      case 'cancelled': return 'red';
      case 'completed': return Colors.light.tint;
      default: return Colors.light.tabIconDefault;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'confirmed': return 'Confirmado';
      case 'pending': return 'Pendiente';
      case 'cancelled': return 'Cancelado';
      case 'completed': return 'Completado';
      default: return status;
    }
  };

  const renderUpcoming = () => {
    const upcomingOrders = scheduledOrders.filter(order => 
      order.status === 'confirmed' || order.status === 'pending'
    );

    return (
      <ScrollView>
        <View style={styles.header}>
          <Text style={styles.sectionTitle}>Próximos Pedidos ({upcomingOrders.length})</Text>
          <TouchableOpacity
            style={styles.scheduleButton}
            onPress={() => setShowScheduleModal(true)}
          >
            <Text style={styles.scheduleButtonText}>+ Programar</Text>
          </TouchableOpacity>
        </View>

        {upcomingOrders.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateTitle}>No tienes pedidos programados</Text>
            <Text style={styles.emptyStateSubtitle}>
              Programa tus pedidos favoritos para que lleguen cuando los necesites
            </Text>
            <TouchableOpacity
              style={styles.emptyStateButton}
              onPress={() => setShowScheduleModal(true)}
            >
              <Text style={styles.emptyStateButtonText}>Programar Primer Pedido</Text>
            </TouchableOpacity>
          </View>
        ) : (
          upcomingOrders.map((order) => {
            const { date, time } = formatDateTime(order.scheduledFor);
            
            return (
              <View key={order.id} style={styles.orderCard}>
                <View style={styles.orderHeader}>
                  <View style={styles.orderInfo}>
                    <Text style={styles.restaurantName}>{order.restaurant.name}</Text>
                    <View style={styles.statusContainer}>
                      <View style={[styles.statusDot, { backgroundColor: getStatusColor(order.status) }]} />
                      <Text style={[styles.statusText, { color: getStatusColor(order.status) }]}>
                        {getStatusText(order.status)}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.modifyButton}
                    onPress={() => modifyScheduledOrder(order.id)}
                  >
                    <Text style={styles.modifyButtonText}>Modificar</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.scheduleInfo}>
                  <Text style={styles.scheduleDate}>📅 {date}</Text>
                  <Text style={styles.scheduleTime}>🕐 {time}</Text>
                  {order.isRecurring && (
                    <Text style={styles.recurringInfo}>
                      🔄 Se repite {order.recurringPattern?.frequency === 'weekly' ? 'semanalmente' : 'mensualmente'}
                    </Text>
                  )}
                </View>

                <View style={styles.orderItems}>
                  {order.items.map((item, index) => (
                    <Text key={index} style={styles.orderItem}>
                      {item.quantity}x {item.name}
                    </Text>
                  ))}
                </View>

                <View style={styles.orderFooter}>
                  <Text style={styles.orderTotal}>{formatCurrency(order.total)}</Text>
                  <View style={styles.orderActions}>
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={() => cancelScheduledOrder(order.id)}
                    >
                      <Text style={styles.cancelButtonText}>Cancelar</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {order.specialInstructions && (
                  <Text style={styles.specialInstructions}>
                    💬 {order.specialInstructions}
                  </Text>
                )}
              </View>
            );
          })
        )}

        {/* Smart Suggestions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sugerencias Inteligentes</Text>
          
          <View style={styles.suggestionCard}>
            <Text style={styles.suggestionTitle}>🧠 Patrón Detectado</Text>
            <Text style={styles.suggestionText}>
              Sueles pedir tacos los viernes a las 7:30 PM. ¿Quieres programarlo automáticamente?
            </Text>
            <TouchableOpacity style={styles.suggestionButton}>
              <Text style={styles.suggestionButtonText}>Programar Automáticamente</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.suggestionCard}>
            <Text style={styles.suggestionTitle}>💰 Ahorra con Programación</Text>
            <Text style={styles.suggestionText}>
              Los pedidos programados antes de las 6 PM tienen 15% de descuento
            </Text>
          </View>
        </View>
      </ScrollView>
    );
  };

  const renderHistory = () => {
    const completedOrders = scheduledOrders.filter(order => 
      order.status === 'completed' || order.status === 'cancelled'
    );

    return (
      <ScrollView>
        <Text style={styles.sectionTitle}>Historial de Pedidos Programados</Text>
        
        {completedOrders.map((order) => {
          const { date, time } = formatDateTime(order.scheduledFor);
          
          return (
            <View key={order.id} style={styles.historyCard}>
              <View style={styles.historyHeader}>
                <Text style={styles.restaurantName}>{order.restaurant.name}</Text>
                <View style={styles.statusContainer}>
                  <View style={[styles.statusDot, { backgroundColor: getStatusColor(order.status) }]} />
                  <Text style={[styles.statusText, { color: getStatusColor(order.status) }]}>
                    {getStatusText(order.status)}
                  </Text>
                </View>
              </View>

              <Text style={styles.historyDate}>{date} a las {time}</Text>
              <Text style={styles.historyTotal}>{formatCurrency(order.total)}</Text>

              {order.status === 'completed' && (
                <TouchableOpacity style={styles.reorderButton}>
                  <Text style={styles.reorderButtonText}>Volver a Programar</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </ScrollView>
    );
  };

  const renderSchedule = () => (
    <ScrollView>
      <Text style={styles.sectionTitle}>Programar Nuevo Pedido</Text>
      
      {/* Quick Schedule Options */}
      <View style={styles.section}>
        <Text style={styles.subsectionTitle}>Opciones Rápidas</Text>
        <View style={styles.quickOptions}>
          <TouchableOpacity style={styles.quickOption}>
            <Text style={styles.quickOptionIcon}>🌅</Text>
            <Text style={styles.quickOptionText}>Desayuno Mañana</Text>
            <Text style={styles.quickOptionTime}>8:00 AM</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.quickOption}>
            <Text style={styles.quickOptionIcon}>🍽️</Text>
            <Text style={styles.quickOptionText}>Almuerzo Hoy</Text>
            <Text style={styles.quickOptionTime}>1:00 PM</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.quickOption}>
            <Text style={styles.quickOptionIcon}>🌙</Text>
            <Text style={styles.quickOptionText}>Cena Hoy</Text>
            <Text style={styles.quickOptionTime}>7:30 PM</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Available Time Slots */}
      <View style={styles.section}>
        <Text style={styles.subsectionTitle}>Horarios Disponibles Hoy</Text>
        <View style={styles.timeSlots}>
          {availableSlots.map((slot) => (
            <TouchableOpacity
              key={slot.time}
              style={[
                styles.timeSlot,
                !slot.available && styles.timeSlotUnavailable,
                slot.surge && styles.timeSlotSurge,
                slot.discount && styles.timeSlotDiscount,
              ]}
              disabled={!slot.available}
            >
              <Text style={[
                styles.timeSlotText,
                !slot.available && styles.timeSlotTextUnavailable
              ]}>
                {slot.time}
              </Text>
              <Text style={styles.timeSlotDelivery}>
                Entrega: {slot.estimatedDelivery}
              </Text>
              {slot.discount && (
                <Text style={styles.timeSlotBadge}>-{slot.discount}%</Text>
              )}
              {slot.surge && (
                <Text style={[styles.timeSlotBadge, styles.surgeBadge]}>Hora pico</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Recurring Orders */}
      <View style={styles.section}>
        <Text style={styles.subsectionTitle}>Pedidos Recurrentes</Text>
        <Text style={styles.sectionDescription}>
          Programa pedidos que se repitan automáticamente
        </Text>
        
        <TouchableOpacity style={styles.recurringOption}>
          <Text style={styles.recurringIcon}>📅</Text>
          <View style={styles.recurringInfo}>
            <Text style={styles.recurringTitle}>Pedido Semanal</Text>
            <Text style={styles.recurringDescription}>
              Mismo pedido cada semana en el día y hora que elijas
            </Text>
          </View>
          <Text style={styles.recurringArrow}>→</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.recurringOption}>
          <Text style={styles.recurringIcon}>🗓️</Text>
          <View style={styles.recurringInfo}>
            <Text style={styles.recurringTitle}>Pedido Mensual</Text>
            <Text style={styles.recurringDescription}>
              Perfecto para ocasiones especiales o reuniones regulares
            </Text>
          </View>
          <Text style={styles.recurringArrow}>→</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Cargando pedidos programados...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pedidos Programados</Text>
      
      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        {[
          { key: 'upcoming', label: 'Próximos' },
          { key: 'history', label: 'Historial' },
          { key: 'schedule', label: 'Programar' },
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
        {activeTab === 'upcoming' && renderUpcoming()}
        {activeTab === 'history' && renderHistory()}
        {activeTab === 'schedule' && renderSchedule()}
      </View>

      {/* Schedule Modal */}
      <Modal
        visible={showScheduleModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowScheduleModal(false)}>
              <Text style={styles.modalCancel}>Cancelar</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Programar Pedido</Text>
            <TouchableOpacity onPress={scheduleOrder}>
              <Text style={styles.modalSave}>Programar</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <Text style={styles.modalSectionTitle}>Selecciona Fecha y Hora</Text>
            
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={styles.dateButtonText}>
                📅 {scheduleForm.deliveryDate.toLocaleDateString('es-VE')}
              </Text>
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={scheduleForm.deliveryDate}
                mode="date"
                display="default"
                onChange={(event, selectedDate) => {
                  setShowDatePicker(false);
                  if (selectedDate) {
                    setScheduleForm({ ...scheduleForm, deliveryDate: selectedDate });
                  }
                }}
                minimumDate={new Date()}
              />
            )}

            <Text style={styles.modalSectionTitle}>Instrucciones Especiales</Text>
            <TextInput
              style={styles.instructionsInput}
              value={scheduleForm.specialInstructions}
              onChangeText={(text) => setScheduleForm({ ...scheduleForm, specialInstructions: text })}
              placeholder="Ej: Sin cebolla, extra salsa..."
              multiline
              numberOfLines={3}
            />

            <View style={styles.recurringSection}>
              <View style={styles.recurringToggle}>
                <Text style={styles.recurringToggleText}>Pedido Recurrente</Text>
                <TouchableOpacity
                  style={[
                    styles.toggle,
                    scheduleForm.isRecurring && styles.toggleActive
                  ]}
                  onPress={() => setScheduleForm({ 
                    ...scheduleForm, 
                    isRecurring: !scheduleForm.isRecurring 
                  })}
                >
                  <View style={[
                    styles.toggleThumb,
                    scheduleForm.isRecurring && styles.toggleThumbActive
                  ]} />
                </TouchableOpacity>
              </View>

              {scheduleForm.isRecurring && (
                <View style={styles.recurringOptions}>
                  <Text style={styles.recurringLabel}>Frecuencia:</Text>
                  <View style={styles.frequencyOptions}>
                    {['daily', 'weekly', 'monthly'].map((freq) => (
                      <TouchableOpacity
                        key={freq}
                        style={[
                          styles.frequencyOption,
                          scheduleForm.recurringFrequency === freq && styles.frequencyOptionActive
                        ]}
                        onPress={() => setScheduleForm({ 
                          ...scheduleForm, 
                          recurringFrequency: freq as any 
                        })}
                      >
                        <Text style={[
                          styles.frequencyOptionText,
                          scheduleForm.recurringFrequency === freq && styles.frequencyOptionTextActive
                        ]}>
                          {freq === 'daily' ? 'Diario' : freq === 'weekly' ? 'Semanal' : 'Mensual'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </Modal>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
  },
  scheduleButton: {
    backgroundColor: Colors.light.tint,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  scheduleButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: 'white',
    borderRadius: 12,
    marginTop: 20,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: Colors.light.tabIconDefault,
    textAlign: 'center',
    marginBottom: 20,
  },
  emptyStateButton: {
    backgroundColor: Colors.light.tint,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyStateButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  orderCard: {
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
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  orderInfo: {
    flex: 1,
  },
  restaurantName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 4,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  modifyButton: {
    backgroundColor: Colors.light.background,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  modifyButtonText: {
    color: Colors.light.tint,
    fontSize: 12,
    fontWeight: '600',
  },
  scheduleInfo: {
    marginBottom: 12,
  },
  scheduleDate: {
    fontSize: 14,
    color: Colors.light.text,
    marginBottom: 2,
  },
  scheduleTime: {
    fontSize: 14,
    color: Colors.light.text,
    marginBottom: 2,
  },
  recurringInfo: {
    fontSize: 12,
    color: Colors.light.tint,
    fontStyle: 'italic',
  },
  orderItems: {
    marginBottom: 12,
  },
  orderItem: {
    fontSize: 14,
    color: Colors.light.tabIconDefault,
    marginBottom: 2,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderTotal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.light.tint,
  },
  orderActions: {
    flexDirection: 'row',
    gap: 8,
  },
  cancelButton: {
    backgroundColor: '#FF5252',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  cancelButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  specialInstructions: {
    fontSize: 12,
    color: Colors.light.tabIconDefault,
    fontStyle: 'italic',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  section: {
    marginTop: 24,
  },
  suggestionCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: Colors.light.tint,
  },
  suggestionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 8,
  },
  suggestionText: {
    fontSize: 14,
    color: Colors.light.tabIconDefault,
    marginBottom: 12,
  },
  suggestionButton: {
    backgroundColor: Colors.light.tint,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  suggestionButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  historyCard: {
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
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  historyDate: {
    fontSize: 14,
    color: Colors.light.tabIconDefault,
    marginBottom: 4,
  },
  historyTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.light.text,
    marginBottom: 12,
  },
  reorderButton: {
    backgroundColor: Colors.light.background,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  reorderButtonText: {
    color: Colors.light.tint,
    fontSize: 14,
    fontWeight: '600',
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 12,
  },
  sectionDescription: {
    fontSize: 14,
    color: Colors.light.tabIconDefault,
    marginBottom: 16,
  },
  quickOptions: {
    flexDirection: 'row',
    gap: 12,
  },
  quickOption: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  quickOptionIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  quickOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.light.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  quickOptionTime: {
    fontSize: 10,
    color: Colors.light.tabIconDefault,
  },
  timeSlots: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  timeSlot: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    minWidth: 100,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.light.tabIconDefault,
  },
  timeSlotUnavailable: {
    backgroundColor: '#f5f5f5',
    opacity: 0.5,
  },
  timeSlotSurge: {
    borderColor: 'orange',
    backgroundColor: '#fff3e0',
  },
  timeSlotDiscount: {
    borderColor: 'green',
    backgroundColor: '#e8f5e8',
  },
  timeSlotText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 4,
  },
  timeSlotTextUnavailable: {
    color: Colors.light.tabIconDefault,
  },
  timeSlotDelivery: {
    fontSize: 10,
    color: Colors.light.tabIconDefault,
    marginBottom: 4,
  },
  timeSlotBadge: {
    fontSize: 10,
    fontWeight: '600',
    color: 'green',
  },
  surgeBadge: {
    color: 'orange',
  },
  recurringOption: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  recurringIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  recurringInfo: {
    flex: 1,
  },
  recurringTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 4,
  },
  recurringDescription: {
    fontSize: 12,
    color: Colors.light.tabIconDefault,
  },
  recurringArrow: {
    fontSize: 18,
    color: Colors.light.tabIconDefault,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
  },
  modalCancel: {
    fontSize: 16,
    color: Colors.light.tabIconDefault,
  },
  modalSave: {
    fontSize: 16,
    color: Colors.light.tint,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 12,
  },
  dateButton: {
    backgroundColor: Colors.light.background,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  dateButtonText: {
    fontSize: 16,
    color: Colors.light.text,
  },
  instructionsInput: {
    borderWidth: 1,
    borderColor: Colors.light.tabIconDefault,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  recurringSection: {
    backgroundColor: Colors.light.background,
    borderRadius: 12,
    padding: 16,
  },
  recurringToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  recurringToggleText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
  },
  toggle: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.light.tabIconDefault,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleActive: {
    backgroundColor: Colors.light.tint,
  },
  toggleThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'white',
    alignSelf: 'flex-start',
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
  },
  recurringOptions: {
    marginTop: 16,
  },
  recurringLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 8,
  },
  frequencyOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  frequencyOption: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.light.tabIconDefault,
    alignItems: 'center',
  },
  frequencyOptionActive: {
    backgroundColor: Colors.light.tint,
    borderColor: Colors.light.tint,
  },
  frequencyOptionText: {
    fontSize: 14,
    color: Colors.light.text,
  },
  frequencyOptionTextActive: {
    color: 'white',
  },
  loadingText: {
    fontSize: 18,
    color: Colors.light.text,
    textAlign: 'center',
    marginTop: 50,
  },
});