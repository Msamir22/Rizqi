// 1. Raw palettes
export const palette = {
  // V1 brand green. Softer and more natural than the previous emerald-only set.
  brandGreen: {
    950: "#052E16",
    900: "#064E3B",
    800: "#065F46",
    700: "#166534",
    600: "#15803D",
    500: "#22C55E",
    400: "#4ADE80",
    300: "#86EFAC",
    200: "#BBF7D0",
    100: "#DCFCE7",
    50: "#F0FDF4",
  },

  // Backward-compatible brand name used across the current app.
  nileGreen: {
    900: "#022C22",
    800: "#064E3B",
    700: "#065F46",
    600: "#059669",
    500: "#10B981",
    400: "#34D399",
    100: "#D1FAE5",
    50: "#ECFDF5",
  },

  // Deep green-black surfaces from the approved dark mockups.
  night: {
    950: "#02090A",
    900: "#051112",
    850: "#071314",
    800: "#0B1A1C",
    700: "#10272A",
    600: "#18383B",
    500: "#2A4A4D",
  },

  // Warm light surfaces from the approved light mockups.
  paper: {
    25: "#FFFFFF",
    50: "#FCFAF6",
    100: "#F7F5EF",
    150: "#F0EEE6",
    200: "#E6E2D8",
    300: "#D7D0C2",
    500: "#8B8171",
  },

  // Wealth/Gold
  gold: {
    900: "#713F12",
    800: "#92400E",
    700: "#B45309",
    600: "#D97706",
    500: "#EAB308",
    400: "#FBBF24",
    300: "#FCD34D",
    100: "#FEF3C7",
    50: "#FFF8E1",
  },

  // Silver
  silver: {
    bg: "#D2D2D4",
    700: "#5E666B",
    600: "#7A8288",
    500: "#A7ADB1",
    400: "#C8CDD0",
    300: "#D9DDE0",
    100: "#F1F3F4",
  },

  // Functional
  danger: {
    700: "#B91C1C",
    600: "#DC2626",
    500: "#EF4444",
    400: "#F87171",
    100: "#FEE2E2",
    50: "#FEF2F2",
  },
  red: {
    600: "#DC2626",
    500: "#EF4444",
    400: "#F87171",
    100: "#FEE2E2",
  },

  // Orange (Coffee/Food)
  orange: {
    600: "#EA580C",
    500: "#F97316",
    100: "#FFEDD5",
  },

  // Info/Bank
  info: {
    700: "#1D4ED8",
    600: "#2563EB",
    500: "#3B82F6",
    100: "#DBEAFE",
    50: "#EFF6FF",
  },
  blue: {
    900: "#172554",
    800: "#1E3A8A",
    600: "#2563EB",
    500: "#3B82F6",
    100: "#DBEAFE",
    50: "#EFF6FF",
  },

  // Violet
  violet: {
    800: "#5B21B6",
    700: "#7C3AED",
    500: "#8B5CF6",
    100: "#EDE9FE",
  },

  // Neutrals (Slate)
  slate: {
    950: "#020617",
    900: "#0F172A",
    800: "#1E293B",
    700: "#334155",
    600: "#475569",
    500: "#64748B",
    400: "#94A3B8",
    300: "#CBD5E1",
    200: "#E2E8F0",
    100: "#F1F5F9",
    50: "#F8FAFC",
    25: "#FFFFFF",
  },

  // Third-Party Brand Colors
  brand: {
    facebook: "#1877F2",
    google: "#4285F4",
  },
} as const;

// 2. Global semantic colors kept for existing icon/component props.
export const colors = {
  primary: palette.brandGreen[700],
  secondary: palette.brandGreen[500],
  accent: palette.gold[600],
  expense: palette.danger[500],
  success: palette.brandGreen[500],
  white: palette.slate[25],
  black: palette.night[950],
} as const;

export interface ThemeColors {
  background: string;
  backgroundGradient: readonly [string, string, ...string[]];
  surface: string;
  surfaceRaised: string;
  surfaceMuted: string;
  surfaceHighlight: string;
  surfaceGlass: string;
  text: {
    primary: string;
    secondary: string;
    muted: string;
    inverse: string;
  };
  border: string;
  borderSubtle: string;
  borderStrong: string;
  borderGlass: string;
  tint: string;
  action: string;
  success: string;
  danger: string;
  info: string;
  metal: {
    gold: string;
    silver: string;
  };
  skeleton: {
    base: string;
    highlight: string;
  };
  statusBarStyle: "light-content" | "dark-content";
}

// 3. Semantic themes
export const lightTheme: ThemeColors = {
  background: palette.paper[50],
  backgroundGradient: [palette.paper[25], palette.paper[50]],
  surface: palette.paper[25],
  surfaceRaised: palette.paper[25],
  surfaceMuted: palette.paper[100],
  surfaceHighlight: palette.paper[100],
  surfaceGlass: "#FFFFFFE6",
  text: {
    primary: palette.slate[900],
    secondary: palette.slate[600],
    muted: palette.slate[500],
    inverse: palette.slate[25],
  },
  border: palette.paper[200],
  borderSubtle: palette.paper[200],
  borderStrong: palette.paper[300],
  borderGlass: "#FFFFFFB3",
  tint: `${palette.brandGreen[500]}1A`,
  action: palette.brandGreen[700],
  success: palette.brandGreen[600],
  danger: palette.danger[500],
  info: palette.info[500],
  metal: {
    gold: palette.gold[500],
    silver: palette.silver[500],
  },
  skeleton: {
    base: palette.paper[200],
    highlight: palette.paper[100],
  },
  statusBarStyle: "dark-content",
};

export const darkTheme: ThemeColors = {
  background: palette.night[950],
  backgroundGradient: [palette.night[950], palette.night[900]],
  surface: palette.night[900],
  surfaceRaised: palette.night[850],
  surfaceMuted: palette.night[800],
  surfaceHighlight: palette.night[700],
  surfaceGlass: "#071314D9",
  text: {
    primary: palette.paper[25],
    secondary: "#CDD6D2",
    muted: "#8DA09A",
    inverse: palette.night[950],
  },
  border: "#FFFFFF1A",
  borderSubtle: "#FFFFFF1F",
  borderStrong: "#FFFFFF33",
  borderGlass: "#FFFFFF26",
  tint: `${palette.brandGreen[500]}33`,
  action: palette.brandGreen[500],
  success: palette.brandGreen[400],
  danger: palette.danger[400],
  info: palette.info[500],
  metal: {
    gold: palette.gold[400],
    silver: palette.silver[400],
  },
  skeleton: {
    base: palette.night[700],
    highlight: palette.night[600],
  },
  statusBarStyle: "light-content",
};
