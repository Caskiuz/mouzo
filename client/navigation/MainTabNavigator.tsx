import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import HomeStackNavigator from "@/navigation/HomeStackNavigator";
import OrdersStackNavigator from "@/navigation/OrdersStackNavigator";
import ProfileStackNavigator from "@/navigation/ProfileStackNavigator";
import BusinessMapScreen from "@/screens/BusinessMapScreen";
import AdminScreenNew from "@/screens/AdminScreenNew";
import BusinessDashboardScreen from "@/screens/BusinessDashboardScreen";
import DeliveryDashboardScreen from "@/screens/DeliveryDashboardScreen";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

// Stack wrapper para el tab Mapa (necesita poder navegar a BusinessDetail)
const MapStack = createNativeStackNavigator();
function MapStackNavigator() {
  return (
    <MapStack.Navigator screenOptions={{ headerShown: false }}>
      <MapStack.Screen name="BusinessMapMain" component={BusinessMapScreen} />
    </MapStack.Navigator>
  );
}
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { MouzoColors, Spacing } from "@/constants/theme";

export type MainTabParamList = {
  HomeTab: undefined;
  OrdersTab: undefined;
  MapTab: undefined;
  ProfileTab: undefined;
  AdminTab: undefined;
  BusinessTab: undefined;
  DeliveryTab: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainTabNavigator() {
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const isBusiness = user?.role === "business_owner";
  const isDelivery = user?.role === "delivery_driver";
  const isCustomer = !isAdmin && !isBusiness && !isDelivery;

const tabBarHeight = Platform.select({
    ios: 56 + insets.bottom,
    android: 64 + Math.max(insets.bottom, 8),
    default: 64,
  });

  return (
    <Tab.Navigator
      initialRouteName="HomeTab"
      screenOptions={{
        tabBarActiveTintColor: MouzoColors.primary,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarStyle: {
          backgroundColor: theme.background,
          borderTopWidth: 1,
          borderTopColor: theme.border,
          elevation: 8,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          height: tabBarHeight,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: Spacing.xs,
        },
        tabBarBackground: undefined,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStackNavigator}
        options={{
          title: "Inicio",
          tabBarIcon: ({ color, size }) => (
            <Feather name="home" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="OrdersTab"
        component={OrdersStackNavigator}
        options={{
          title: "Pedidos",
          tabBarIcon: ({ color, size }) => (
            <Feather name="shopping-bag" size={size} color={color} />
          ),
        }}
      />
      {isCustomer ? (
        <Tab.Screen
          name="MapTab"
          component={MapStackNavigator}
          options={{
            title: "Mapa",
            tabBarIcon: ({ color, size }) => (
              <Feather name="map-pin" size={size} color={color} />
            ),
          }}
        />
      ) : null}
      {isAdmin ? (
        <Tab.Screen
          name="AdminTab"
          component={AdminScreenNew}
          options={{
            title: "Admin",
            tabBarIcon: ({ color, size }) => (
              <Feather name="settings" size={size} color={color} />
            ),
          }}
        />
      ) : null}
      {isBusiness ? (
        <Tab.Screen
          name="BusinessTab"
          component={BusinessDashboardScreen}
          options={{
            title: "Mi Negocio",
            tabBarIcon: ({ color, size }) => (
              <Feather name="briefcase" size={size} color={color} />
            ),
          }}
        />
      ) : null}
      {isDelivery ? (
        <Tab.Screen
          name="DeliveryTab"
          component={DeliveryDashboardScreen}
          options={{
            title: "Entregas",
            tabBarIcon: ({ color, size }) => (
              <Feather name="truck" size={size} color={color} />
            ),
          }}
        />
      ) : null}
      <Tab.Screen
        name="ProfileTab"
        component={ProfileStackNavigator}
        options={{
          title: "Perfil",
          tabBarIcon: ({ color, size }) => (
            <Feather name="user" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
