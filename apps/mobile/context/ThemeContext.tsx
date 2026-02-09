import { darkTheme, lightTheme, ThemeColors } from "../constants/colors";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { Appearance, ColorSchemeName, View } from "react-native";
import { useColorScheme } from "nativewind";

/**
 * Theme modes supported by the app
 */
export type ThemeMode = "light" | "dark" | "system";

const STORAGE_THEME_KEY = "astik_theme_mode";

interface ThemeContextType {
  mode: ThemeMode;
  theme: ThemeColors;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
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
 * Hook to access theme context
 * @throws {Error} When used outside of ThemeProvider
 */
export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};

/**
 * Resolves the actual color scheme based on mode and system preference
 */
const resolveColorScheme = (
  mode: ThemeMode,
  systemColorScheme: ColorSchemeName
): ColorScheme => {
  switch (mode) {
    case "light":
      return "light";
    case "dark":
      return "dark";
    case "system":
      return systemColorScheme === "dark" ? "dark" : "light";
    default:
      return "light";
  }
};

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  defaultMode = "system",
}) => {
  const [mode, setMode] = useState<ThemeMode>(defaultMode);
  const [systemColorScheme, setSystemColorScheme] = useState<ColorSchemeName>(
    Appearance.getColorScheme()
  );
  const [isLoading, setIsLoading] = useState(true);

  const { setColorScheme } = useColorScheme();

  // Resolve current color scheme based on mode and system preference
  const colorScheme = resolveColorScheme(mode, systemColorScheme);
  const isDark = colorScheme === "dark";

  /**
   * Load theme preference from storage on app start
   */
  const loadThemeFromStorage = useCallback(async (): Promise<void> => {
    try {
      const storedMode = await AsyncStorage.getItem(STORAGE_THEME_KEY);
      if (storedMode && ["light", "dark", "system"].includes(storedMode)) {
        setTheme(storedMode as ThemeMode);
      }
    } catch (error) {
      console.warn("Failed to load theme from storage:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

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
    (newMode: ThemeMode): void => {
      setMode(newMode);
      saveThemeToStorage(newMode);
    },
    [saveThemeToStorage]
  );

  /**
   * Toggle between light and dark modes
   * If currently in system mode, toggles to the opposite of current system theme
   */
  const toggleTheme = useCallback((): void => {
    const newMode = isDark ? "light" : "dark";
    setTheme(newMode);
  }, [isDark, setTheme]);

  /**
   * Handle system color scheme changes
   */
  const handleSystemColorSchemeChange = useCallback(
    (newColorScheme: ColorSchemeName): void => {
      setSystemColorScheme(newColorScheme);
    },
    []
  );

  /**
   * Update NativeWind's color scheme when our resolved scheme changes
   */
  useEffect(() => {
    setColorScheme(colorScheme);
  }, [colorScheme, setColorScheme]);

  /**
   * Set up system theme listener and load stored theme on mount
   */
  useEffect(() => {
    loadThemeFromStorage();

    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      handleSystemColorSchemeChange(colorScheme);
    });

    return () => subscription?.remove();
  }, [loadThemeFromStorage, handleSystemColorSchemeChange]);

  const theme = isDark ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider
      value={{ mode, theme, isDark, colorScheme, toggleTheme, setTheme }}
    >
      <View style={{ flex: 1 }}>{children}</View>
    </ThemeContext.Provider>
  );
};
