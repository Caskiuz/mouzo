// Dark Mode Theme for Rabbit Food App
export const darkTheme = {
  colors: {
    primary: '#E8B4A8',
    primaryDark: '#D4A89C',
    primaryLight: '#F5D5CC',
    secondary: '#C9A882',
    background: '#1A1612',
    backgroundSecondary: '#252018',
    surface: '#2D2620',
    error: '#E85555',
    warning: '#F0B560',
    success: '#7BC47B',
    info: '#6BB0E0',
    text: {
      primary: '#F5F1EB',
      secondary: '#C9BFB3',
      disabled: '#6B5D4F',
      inverse: '#1A1612',
    },
    border: '#3D3226',
    divider: '#2D2620',
    overlay: 'rgba(0, 0, 0, 0.7)',
    carnival: {
      pink: '#E8B4A8',
      purple: '#D4A89C',
      gold: '#F5D5CC',
    },
  },
};

export type DarkTheme = typeof darkTheme;
export const RabbitFoodDarkColors = darkTheme.colors;
