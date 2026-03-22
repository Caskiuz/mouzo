/**
 * Coordenadas de cobertura de San Cristóbal, Táchira, Venezuela
 */
export const SAN_CRISTOBAL_BOUNDS = {
  minLat: 7.75,
  maxLat: 7.80,
  minLng: -72.25,
  maxLng: -72.20,
};

/**
 * Centro de San Cristóbal para inicializar mapas
 */
export const SAN_CRISTOBAL_CENTER = {
  latitude: 7.7669,
  longitude: -72.2250,
};

// Legacy aliases
export const AUTLAN_BOUNDS = SAN_CRISTOBAL_BOUNDS;
export const AUTLAN_CENTER = SAN_CRISTOBAL_CENTER;

/**
 * Valida si unas coordenadas están dentro de la zona de cobertura
 */
export const isInCoverageArea = (latitude: number, longitude: number): boolean => {
  return (
    latitude >= SAN_CRISTOBAL_BOUNDS.minLat &&
    latitude <= SAN_CRISTOBAL_BOUNDS.maxLat &&
    longitude >= SAN_CRISTOBAL_BOUNDS.minLng &&
    longitude <= SAN_CRISTOBAL_BOUNDS.maxLng
  );
};
