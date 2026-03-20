// API Configuration for MOUZO Frontend
import { Platform } from "react-native";
import Constants from "expo-constants";

// DEVELOPMENT: Set to true to disable GPS tracking and use fixed location from DB
const DISABLE_GPS_IN_DEV = true;

// Get API base URL dynamically at runtime
export const getApiBaseUrl = (): string => {
  // Check expo config first (from app.config.js) - works in both dev and prod
  const expoBackendUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL;
  if (expoBackendUrl) {
    console.log('✅ Using EXPO_PUBLIC_BACKEND_URL from config:', expoBackendUrl);
    return expoBackendUrl;
  }

  // Check for environment variable (development)
  const envBackendUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
  if (envBackendUrl) {
    const trimmed = envBackendUrl.trim();
    console.log('Using EXPO_PUBLIC_BACKEND_URL from env:', trimmed);
    return trimmed;
  }

  // Development mode - use localhost
  if (__DEV__) {
    console.log('🔧 Development mode: using localhost:5000');
    return "http://localhost:5000";
  }

  // For web in production, use current origin (same domain)
  if (Platform.OS === "web" && typeof window !== "undefined" && window.location) {
    return window.location.origin;
  }

  // Production fallback
  console.log('✅ Using production URL: https://mouzo-backend.onrender.com');
  return "https://mouzo-backend.onrender.com";
};

export const API_CONFIG = {
  get BASE_URL() {
    return getApiBaseUrl();
  },
  ENDPOINTS: {
    AUTH: {
      VERIFY_PHONE: "/api/auth/verify-phone",
      SEND_CODE: "/api/auth/send-code",
      LOGIN: "/api/auth/login",
      LOGOUT: "/api/auth/logout",
    },
    BUSINESSES: {
      LIST: "/api/businesses",
      DETAIL: (id: string) => `/api/businesses/${id}`,
      PRODUCTS: (id: string) => `/api/businesses/${id}/products`,
    },
    ORDERS: {
      CREATE: "/api/orders",
      LIST: "/api/orders",
      DETAIL: (id: string) => `/api/orders/${id}`,
      UPDATE_STATUS: (id: string) => `/api/orders/${id}/status`,
    },
    USERS: {
      PROFILE: "/api/user/profile",
      UPDATE: "/api/user/profile",
    },
  },
  TIMEOUT: 10000, // 10 seconds
};

export const GPS_CONFIG = {
  DISABLE_IN_DEV: DISABLE_GPS_IN_DEV,
};

// Helper function to build full URL
export const buildApiUrl = (endpoint: string) => {
  return `${API_CONFIG.BASE_URL}${endpoint}`;
};

// Default headers for API requests
export const getDefaultHeaders = (token?: string) => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
};

console.log("🔗 API Configuration:", {
  baseUrl: API_CONFIG.BASE_URL,
  isDev: __DEV__,
  platform: Platform.OS,
});
