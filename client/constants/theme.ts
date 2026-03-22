// Unified Design System for Rabbit Food App
export const theme = {
  colors: {
    primary: '#E8B4A8',
    primaryDark: '#D4A89C',
    primaryLight: '#F5D5CC',
    secondary: '#C9A882',
    background: '#FAF8F5',
    backgroundSecondary: '#F5F1EB',
    surface: '#FFFCF7',
    error: '#D84A4A',
    warning: '#E8A84E',
    success: '#6BAF6B',
    info: '#5BA3D4',
    text: {
      primary: '#3D3226',
      secondary: '#6B5D4F',
      disabled: '#B5A89A',
      inverse: '#FFFCF7',
    },
    border: '#E5DDD1',
    divider: '#F0E9DD',
    overlay: 'rgba(61, 50, 38, 0.5)',
    carnival: {
      pink: '#E8B4A8',
      purple: '#D4A89C',
      gold: '#F5D5CC',
    },
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
    "3xl": 56,
    "4xl": 64,
    buttonHeight: 52,
  },
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    full: 9999,
  },
  typography: {
    h1: { fontSize: 32, fontWeight: '700' as const, lineHeight: 40 },
    h2: { fontSize: 24, fontWeight: '700' as const, lineHeight: 32 },
    h3: { fontSize: 20, fontWeight: '600' as const, lineHeight: 28 },
    h4: { fontSize: 18, fontWeight: '600' as const, lineHeight: 24 },
    body: { fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
    bodySmall: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
    caption: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16 },
    button: { fontSize: 16, fontWeight: '600' as const, lineHeight: 24 },
  },
  shadows: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 4,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 8,
    },
  },
};

export type Theme = typeof theme;

// Export individual objects for easier imports
export const RabbitFoodColors = theme.colors;
export const MouzoColors = theme.colors; // Legacy alias
export const Spacing = theme.spacing;
export const BorderRadius = theme.borderRadius;
export const Typography = theme.typography;
export const Shadows = theme.shadows;
