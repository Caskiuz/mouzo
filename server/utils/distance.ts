/**
 * Calcula la distancia entre dos coordenadas GPS usando la fórmula de Haversine
 * @returns Distancia en kilómetros
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
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
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Calcula el delivery fee basado en la distancia
 * Tarifas ajustadas para San Cristóbal, Táchira
 */
export function calculateDeliveryFee(distance: number): number {
  const BASE_FEE = 15;  // $15 MXN base (reducido para ciudad pequeña)
  const PER_KM = 8;     // $8 MXN por km
  const MIN_FEE = 15;   // Mínimo $15 MXN
  const MAX_FEE = 40;   // Máximo $40 MXN (San Cristóbal es pequeño, ~5km diámetro)
  
  const fee = BASE_FEE + (distance * PER_KM);
  return Math.max(MIN_FEE, Math.min(fee, MAX_FEE));
}

/**
 * Estima el tiempo de entrega basado en distancia
 * @returns Tiempo en minutos
 */
export function estimateDeliveryTime(distance: number, prepTime: number = 20): number {
  const SPEED_KM_PER_MIN = 0.5; // ~30 km/h promedio en ciudad
  const travelTime = distance / SPEED_KM_PER_MIN;
  return Math.ceil(prepTime + travelTime);
}

/**
 * Valida si unas coordenadas están dentro de la zona de cobertura de San Cristóbal
 */
export function isInCoverageArea(latitude: number, longitude: number): boolean {
  const AUTLAN_BOUNDS = {
    minLat: 19.75,
    maxLat: 19.80,
    minLng: -104.40,
    maxLng: -104.30,
  };
  
  return (
    latitude >= AUTLAN_BOUNDS.minLat &&
    latitude <= AUTLAN_BOUNDS.maxLat &&
    longitude >= AUTLAN_BOUNDS.minLng &&
    longitude <= AUTLAN_BOUNDS.maxLng
  );
}
