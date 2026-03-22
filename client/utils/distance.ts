/**
 * Calcula la distancia entre dos coordenadas GPS usando la fórmula de Haversine
 * @returns Distancia en kilómetros
 */
export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371; // Radio de la Tierra en km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const toRad = (deg: number) => deg * (Math.PI / 180);

let cachedConfig: any = null;
let lastFetch = 0;

async function getConfig() {
  const now = Date.now();
  if (cachedConfig && (now - lastFetch) < 60000) {
    return cachedConfig;
  }

  try {
    const { apiRequest } = await import('@/lib/query-client');
    const response = await apiRequest('GET', '/api/delivery/config');
    const data = await response.json();
    if (data.success) {
      cachedConfig = data.config;
      lastFetch = now;
      return data.config;
    }
  } catch (error) {
    console.error('Error loading delivery config:', error);
  }

  return { baseFee: 15, perKm: 8, minFee: 15, maxFee: 40 };
}

/**
 * Calcula el delivery fee basado en la distancia
 * Tarifas ajustadas para San Cristóbal, Táchira, Venezuela
 */
export const calculateDeliveryFee = async (distance: number): Promise<number> => {
  const config = await getConfig();
  const fee = config.baseFee + (distance * config.perKm);
  return Math.max(config.minFee, Math.min(fee, config.maxFee));
};

/**
 * Estima el tiempo de entrega basado en distancia
 * @returns Tiempo en minutos
 */
export const estimateDeliveryTime = (distance: number, prepTime: number = 20): number => {
  const SPEED_KM_PER_MIN = 0.5; // ~30 km/h promedio en ciudad
  const travelTime = distance / SPEED_KM_PER_MIN;
  return Math.ceil(prepTime + travelTime);
};
