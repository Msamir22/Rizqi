/** @type {import('tailwindcss').Config} */

import { darkTheme, lightTheme, palette } from "./constants/colors";

module.exports = {
  darkMode: "class",
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // UI
        background: {
          DEFAULT: lightTheme.background,
          dark: darkTheme.background,
        },
        app: {
          DEFAULT: lightTheme.background,
          dark: darkTheme.background,
        },
        gradient: {
          start: {
            DEFAULT: lightTheme.backgroundGradient[0],
            dark: darkTheme.backgroundGradient[0],
          },
          end: {
            DEFAULT: lightTheme.backgroundGradient[1],
            dark: darkTheme.backgroundGradient[1],
          },
        },
        surface: {
          DEFAULT: lightTheme.surface,
          dark: darkTheme.surface,
          raised: {
            DEFAULT: lightTheme.surfaceRaised,
            dark: darkTheme.surfaceRaised,
          },
          muted: {
            DEFAULT: lightTheme.surfaceMuted,
            dark: darkTheme.surfaceMuted,
          },
          highlight: {
            DEFAULT: lightTheme.surfaceHighlight,
            dark: darkTheme.surfaceHighlight,
          },
        },
        card: {
          DEFAULT: lightTheme.surfaceRaised,
          dark: darkTheme.surfaceRaised,
          muted: {
            DEFAULT: lightTheme.surfaceMuted,
            dark: darkTheme.surfaceMuted,
          },
        },
        glass: {
          DEFAULT: lightTheme.surfaceGlass,
          dark: darkTheme.surfaceGlass,
        },
        text: {
          primary: {
            DEFAULT: lightTheme.text.primary,
            dark: darkTheme.text.primary,
          },
          secondary: {
            DEFAULT: lightTheme.text.secondary,
            dark: darkTheme.text.secondary,
          },
          muted: {
            DEFAULT: lightTheme.text.muted,
            dark: darkTheme.text.muted,
          },
          inverse: {
            DEFAULT: lightTheme.text.inverse,
            dark: darkTheme.text.inverse,
          },
        },
        border: {
          DEFAULT: lightTheme.border,
          dark: darkTheme.border,
          subtle: {
            DEFAULT: lightTheme.borderSubtle,
            dark: darkTheme.borderSubtle,
          },
          strong: {
            DEFAULT: lightTheme.borderStrong,
            dark: darkTheme.borderStrong,
          },
          card: {
            DEFAULT: lightTheme.borderSubtle,
            dark: darkTheme.borderSubtle,
          },
          glass: {
            DEFAULT: lightTheme.borderGlass,
            dark: darkTheme.borderGlass,
          },
        },
        action: {
          DEFAULT: lightTheme.action,
          dark: darkTheme.action,
        },
        success: {
          DEFAULT: lightTheme.success,
          dark: darkTheme.success,
        },
        danger: {
          DEFAULT: lightTheme.danger,
          dark: darkTheme.danger,
        },
        info: {
          DEFAULT: lightTheme.info,
          dark: darkTheme.info,
        },
        metal: {
          gold: {
            DEFAULT: lightTheme.metal.gold,
            dark: darkTheme.metal.gold,
          },
          silver: {
            DEFAULT: lightTheme.metal.silver,
            dark: darkTheme.metal.silver,
          },
        },
        tabBar: {
          overlayLight: "rgba(0, 0, 0, 0.5)",
          overlayDark: "rgba(0, 0, 0, 0.7)",
          bgLight: "rgba(255, 255, 255, 0.85)",
          bgDark: "rgba(15, 23, 42, 0.85)",
        },

        // Colors
        brandGreen: {
          50: palette.brandGreen[50],
          100: palette.brandGreen[100],
          200: palette.brandGreen[200],
          300: palette.brandGreen[300],
          400: palette.brandGreen[400],
          500: palette.brandGreen[500],
          600: palette.brandGreen[600],
          700: palette.brandGreen[700],
          800: palette.brandGreen[800],
          900: palette.brandGreen[900],
          950: palette.brandGreen[950],
        },
        night: {
          500: palette.night[500],
          600: palette.night[600],
          700: palette.night[700],
          800: palette.night[800],
          850: palette.night[850],
          900: palette.night[900],
          950: palette.night[950],
        },
        paper: {
          25: palette.paper[25],
          50: palette.paper[50],
          100: palette.paper[100],
          150: palette.paper[150],
          200: palette.paper[200],
          300: palette.paper[300],
          500: palette.paper[500],
        },
        slate: {
          25: palette.slate[25],
          50: palette.slate[50],
          100: palette.slate[100],
          200: palette.slate[200],
          300: palette.slate[300],
          400: palette.slate[400],
          500: palette.slate[500],
          600: palette.slate[600],
          700: palette.slate[700],
          800: palette.slate[800],
          900: palette.slate[900],
          950: palette.slate[950],
        },
        red: {
          500: palette.red[500],
          600: palette.red[600],
          400: palette.red[400],
          100: palette.red[100],
        },
        dangerPalette: {
          50: palette.danger[50],
          100: palette.danger[100],
          400: palette.danger[400],
          500: palette.danger[500],
          600: palette.danger[600],
          700: palette.danger[700],
        },
        nileGreen: {
          50: palette.nileGreen[50],
          100: palette.nileGreen[100],
          400: palette.nileGreen[400],
          500: palette.nileGreen[500],
          600: palette.nileGreen[600],
          700: palette.nileGreen[700],
          800: palette.nileGreen[800],
          900: palette.nileGreen[900],
        },
        gold: {
          50: palette.gold[50],
          100: palette.gold[100],
          300: palette.gold[300],
          400: palette.gold[400],
          500: palette.gold[500],
          600: palette.gold[600],
          700: palette.gold[700],
          800: palette.gold[800],
          900: palette.gold[900],
        },
        silver: {
          bg: palette.silver.bg,
          100: palette.silver[100],
          300: palette.silver[300],
          400: palette.silver[400],
          500: palette.silver[500],
          600: palette.silver[600],
          700: palette.silver[700],
        },
        blue: {
          50: palette.blue[50],
          100: palette.blue[100],
          500: palette.blue[500],
          600: palette.blue[600],
        },
        infoPalette: {
          50: palette.info[50],
          100: palette.info[100],
          500: palette.info[500],
          600: palette.info[600],
          700: palette.info[700],
        },
        orange: {
          100: palette.orange[100],
          500: palette.orange[500],
          600: palette.orange[600],
        },
      },
    },
  },
  plugins: [],
};
