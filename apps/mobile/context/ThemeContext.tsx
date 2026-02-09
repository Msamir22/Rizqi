import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColorScheme } from "nativewind";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { Appearance, ColorSchemeName, View } from "react-native";
import { darkTheme, lightTheme, ThemeColors } from "../constants/colors";

/**
 * Theme modes supported by the app
 */
export type ThemeMode = "light" | "dark" | "system";

const STORAGE_THEME_KEY = "astik_theme_mode";

interface ThemeContextType {
  mode: ThemeMode;
  theme: ThemeColors;
  isDark: boolean;
  toggleTheme: () => Promise<void>;
  setTheme: (mode: ThemeMode) => Promise<void>;
  colorScheme: ColorScheme;
}

type ColorScheme = "light" | "dark";

/**
 * Props for ThemeProvider component
 */
interface ThemeProviderProps {
  children: React.ReactNode;
  /**
   * Default theme mode. Defaults to 'system'
   */
  defaultMode?: ThemeMode;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/**
 * Custom hook to use the theme context
 */
export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

/**
 * ThemeProvider component that manages the app's theme state and persistence
 */
export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  defaultMode = "system",
}) => {
  const [mode, setMode] = useState<ThemeMode>(defaultMode);
  const [_isLoading, setIsLoading] = useState(true);
  const nwColorScheme = useColorScheme();

  // Resolve system theme
  const [colorScheme, setSystemColorScheme] = useState<ColorScheme>(
    Appearance.getColorScheme() === "dark" ? "dark" : "light"
  );

  // Derived state for quick checks
  const isDark =
    mode === "dark" || (mode === "system" && colorScheme === "dark");

  /**
   * Save theme preference to storage
   */
  const saveThemeToStorage = useCallback(
    async (themeMode: ThemeMode): Promise<void> => {
      try {
        await AsyncStorage.setItem(STORAGE_THEME_KEY, themeMode);
      } catch (error) {
        console.warn("Failed to save theme to storage:", error);
      }
    },
    []
  );

  /**
   * Set theme mode and persist to storage
   */
  const setTheme = useCallback(
    async (newMode: ThemeMode): Promise<void> => {
      setMode(newMode);
      await saveThemeToStorage(newMode);
    },
    [saveThemeToStorage]
  );

  /**
   * Load theme preference from storage on app start
   */
  const loadThemeFromStorage = useCallback(async (): Promise<void> => {
    try {
      const storedMode = await AsyncStorage.getItem(STORAGE_THEME_KEY);
      if (storedMode && ["light", "dark", "system"].includes(storedMode)) {
        await setTheme(storedMode as ThemeMode);
      }
    } catch (error) {
      console.warn("Failed to load theme from storage:", error);
    } finally {
      setIsLoading(false);
    }
  }, [setTheme]);

  /**
   * Toggle between light and dark modes
   * If currently in system mode, toggles to the opposite of current system theme
   */
  const toggleTheme = useCallback(async (): Promise<void> => {
    const newMode =
      mode === "dark" || (mode === "system" && colorScheme === "dark")
        ? "light"
        : "dark";
    await setTheme(newMode);
  }, [mode, colorScheme, setTheme]);

  /**
   * Handle system color scheme changes
   */
  const handleSystemColorSchemeChange = useCallback(
    (newColorScheme: ColorSchemeName): void => {
      if (newColorScheme) {
        setSystemColorScheme(newColorScheme as ColorScheme);
      }
    },
    []
  );

  /**
   * Update NativeWind's color scheme when our resolved scheme changes
   */
  useEffect(() => {
    nwColorScheme.setColorScheme(colorScheme);
  }, [colorScheme, nwColorScheme]);

  /**
   * Set up system theme listener and load stored theme on mount
   */
  useEffect(() => {
    loadThemeFromStorage().catch(console.error);

    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      handleSystemColorSchemeChange(colorScheme);
    });

    return () => subscription?.remove();
  }, [loadThemeFromStorage, handleSystemColorSchemeChange]);

  const theme =
    mode === "dark" || (mode === "system" && colorScheme === "dark")
      ? darkTheme
      : lightTheme;

  return (
    <ThemeContext.Provider
      value={{ mode, theme, isDark, colorScheme, toggleTheme, setTheme }}
    >
      <View className="flex-1">{children}</View>
    </ThemeContext.Provider>
  );
};
