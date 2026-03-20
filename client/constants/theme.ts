// Unified Design System for MOUZO App
export const theme = {
  colors: {
    primary: '#FF8C00',
    primaryDark: '#FF7F00',
    primaryLight: '#FFA500',
    secondary: '#FF6B35',
    background: '#FFFFFF',
    backgroundSecondary: '#F5F5F5',
    surface: '#FFFFFF',
    error: '#F44336',
    warning: '#FF9800',
    success: '#4CAF50',
    info: '#2196F3',
    text: {
      primary: '#212121',
      secondary: '#757575',
      disabled: '#BDBDBD',
      inverse: '#FFFFFF',
    },
    border: '#E0E0E0',
    divider: '#EEEEEE',
    overlay: 'rgba(0, 0, 0, 0.5)',
    carnival: {
      pink: '#E91E63',
      purple: '#9C27B0',
      gold: '#FF8C00',
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
export const MouzoColors = theme.colors;
export const Spacing = theme.spacing;
export const BorderRadius = theme.borderRadius;
export const Typography = theme.typography;
export const Shadows = theme.shadows;
