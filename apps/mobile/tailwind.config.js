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
          highlight: {
            DEFAULT: lightTheme.surfaceHighlight,
            dark: darkTheme.surfaceHighlight,
          },
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
        },
        tabBar: {
          overlayLight: "rgba(0, 0, 0, 0.5)",
          overlayDark: "rgba(0, 0, 0, 0.7)",
          bgLight: "rgba(255, 255, 255, 0.85)",
          bgDark: "rgba(15, 23, 42, 0.85)",
        },

        // Colors
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
          100: palette.red[100],
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
          400: palette.gold[400],
          600: palette.gold[600],
          800: palette.gold[800],
        },
        silver: {
          bg: palette.silver.bg,
          500: palette.silver[500],
        },
        blue: {
          50: palette.blue[50],
          100: palette.blue[100],
          500: palette.blue[500],
          600: palette.blue[600],
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
