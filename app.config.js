export default {
  expo: {
    name: "Rabbit Food",
    slug: "rabbitfood",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "rabbitfood",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.rabbitfood.app",
      infoPlist: {
        NSLocationWhenInUseUsageDescription: "Necesitamos tu ubicacion para asignarte pedidos y mostrar tu posicion en tiempo real."
      }
    },
    android: {
      adaptiveIcon: {
        backgroundColor: "#E8B4A8",
        foregroundImage: "./assets/images/icon.png"
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      package: "com.rabbitfood.app",
      config: {
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "AIzaSyDLejpcrNJNHzQIduWuot5QAoepitVk2zY"
        }
      }
    },
    web: {
      output: "single",
      favicon: "./assets/images/icon.png"
    },
    plugins: [
      [
        "expo-splash-screen",
        {
          image: "./assets/images/splash-icon.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#E8B4A8",
          dark: {
            backgroundColor: "#1A1A1A",
            image: "./assets/images/splash-icon.png"
          }
        }
      ],
      "expo-web-browser",
      "expo-secure-store",
      [
        "react-native-maps",
        {
          googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "AIzaSyDLejpcrNJNHzQIduWuot5QAoepitVk2zY"
        }
      ]
    ],
    experiments: {
      reactCompiler: true
    },
    extra: {
      eas: {
        projectId: "8c58541f-bf02-4e36-bcf9-a2e64b126a5b"
      },
      // CRITICAL: Backend URL for production builds
      EXPO_PUBLIC_BACKEND_URL: "http://localhost:5000"
    },
    owner: "caskiuzs-organization"
  }
};
