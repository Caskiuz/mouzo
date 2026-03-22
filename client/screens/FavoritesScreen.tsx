import React from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { EmptyState } from "@/components/EmptyState";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius, RabbitFoodColors, Shadows } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { apiRequest } from "@/lib/query-client";

type FavoritesNavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface Favorite {
  id: string;
  userId: string;
  businessId: string | null;
  productId: string | null;
  createdAt: string;
  business?: {
    id: string;
    name: string;
    image: string;
    type: string;
    rating: string;
  };
  product?: {
    id: string;
    name: string;
    price: number;
    image: string;
    businessId: string;
  };
}

function FavoriteCard({
  favorite,
  onRemove,
  onPress,
}: {
  favorite: Favorite;
  onRemove: () => void;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const isBusiness = !!favorite.business;
  const item = isBusiness ? favorite.business : favorite.product;

  if (!item) return null;

  return (
    <Animated.View entering={FadeInDown.springify()}>
      <Pressable
        onPress={onPress}
        style={[styles.card, { backgroundColor: theme.card }, Shadows.md]}
      >
        <Image
          source={{ uri: item.image }}
          style={styles.image}
          contentFit="cover"
        />
        <View style={styles.cardContent}>
          <ThemedText type="h4" numberOfLines={1}>
            {item.name}
          </ThemedText>
          {isBusiness && favorite.business ? (
            <View style={styles.businessMeta}>
              <View style={styles.ratingRow}>
                <Feather name="star" size={14} color={RabbitFoodColors.primary} />
                <ThemedText type="caption" style={{ marginLeft: 4 }}>
                  {parseFloat(favorite.business.rating).toFixed(1)}
                </ThemedText>
              </View>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                {favorite.business.type === "restaurant"
                  ? "Restaurante"
                  : "Mercado"}
              </ThemedText>
            </View>
          ) : favorite.product ? (
            <ThemedText
              type="body"
              style={{ color: RabbitFoodColors.primary, fontWeight: "600" }}
            >
              ${(favorite.product.price / 100).toFixed(2)}
            </ThemedText>
          ) : null}
        </View>
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onRemove();
          }}
          style={styles.removeButton}
        >
          <Feather name="heart" size={20} color="#F44336" />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

export default function FavoritesScreen() {
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation<FavoritesNavigationProp>();
  const queryClient = useQueryClient();
  const [testData, setTestData] = React.useState<any>(null);

  // TEST DIRECTO
  React.useEffect(() => {
    if (user?.id) {
      console.log('🧪 TEST: Haciendo petición directa a /api/favorites/' + user.id);
      fetch(`http://localhost:5000/api/favorites/${user.id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || sessionStorage.getItem('token')}`
        }
      })
        .then(r => r.json())
        .then(data => {
          console.log('🧪 TEST: Respuesta recibida:', data);
          setTestData(data);
        })
        .catch(err => console.error('🧪 TEST: Error:', err));
    }
  }, [user?.id]);

  console.log('FavoritesScreen - user:', user?.id);
  console.log('FavoritesScreen - user exists:', !!user?.id);
  console.log('🧪 TEST DATA:', testData);

  const {
    data: favoritesResponse,
    isLoading,
    refetch,
    isRefetching,
    error,
  } = useQuery<Favorite[]>({
    queryKey: ["/api/favorites", user?.id],
    queryFn: async () => {
      if (!user?.id) {
        console.log('❌ No user ID, returning empty array');
        return [];
      }
      console.log('🔍 Fetching favorites for user:', user?.id);
      const response = await apiRequest("GET", `/api/favorites/${user?.id}`);
      if (!response.ok) {
        console.error('❌ Favorites request failed:', response.status);
        throw new Error('Failed to fetch favorites');
      }
      const data = await response.json();
      console.log('✅ Favorites data received:', data);
      return Array.isArray(data) ? data : [];
    },
    enabled: !!user?.id,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const favorites = favoritesResponse || [];

  console.log('Favorites:', favorites, 'isLoading:', isLoading, 'error:', error);

  const removeFavoriteMutation = useMutation({
    mutationFn: async (favoriteId: string) => {
      await apiRequest("DELETE", `/api/favorites/${favoriteId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/favorites", user?.id] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const handlePress = (favorite: Favorite) => {
    if (favorite.business) {
      navigation.navigate("BusinessDetail", {
        businessId: favorite.business.id,
      });
    } else if (favorite.product) {
      navigation.navigate("ProductDetail", {
        productId: favorite.product.id,
        businessId: favorite.product.businessId,
        businessName: "",
      });
    }
  };

  if (favorites.length === 0 && !isLoading) {
    return (
      <LinearGradient
        colors={[theme.gradientStart || '#FFFFFF', theme.gradientEnd || '#F5F5F5']}
        style={[
          styles.container,
          {
            paddingTop: Spacing.md,
            paddingBottom: tabBarHeight,
          },
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <EmptyState
          image={require("../../assets/images/market-basket.png")}
          title="🔴 PRUEBA - Sin favoritos aún"
          description="SI VES ESTO EL ARCHIVO ES CORRECTO - Guarda tus negocios y productos favoritos para acceder rápidamente"
        />
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={[theme.gradientStart || '#FFFFFF', theme.gradientEnd || '#F5F5F5']}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <FlatList
        data={favorites}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <FavoriteCard
            favorite={item}
            onRemove={() => removeFavoriteMutation.mutate(item.id)}
            onPress={() => handlePress(item)}
          />
        )}
        contentContainerStyle={[
          styles.list,
          {
            paddingTop: Spacing.md,
            paddingBottom: tabBarHeight + Spacing.xl,
          },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={RabbitFoodColors.primary}
          />
        }
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    paddingHorizontal: Spacing.lg,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  image: {
    width: 60,
    height: 60,
    borderRadius: BorderRadius.md,
  },
  cardContent: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  businessMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginTop: 4,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  removeButton: {
    padding: Spacing.sm,
  },
});
