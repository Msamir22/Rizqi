import { palette } from "@/constants/colors";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/context/AuthContext";
import { useDatabase } from "@/providers/DatabaseProvider";
import { performLogout } from "@/services/logout-service";
import { router, useSegments } from "expo-router";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

interface LogoutContextValue {
  readonly isLoggingOut: boolean;
  readonly requestLogout: (forceSkipSync?: boolean) => void;
}

const LogoutContext = createContext<LogoutContextValue | null>(null);
const LOGOUT_OVERLAY_RELEASE_DELAY_MS = 250;

interface LogoutProviderProps {
  readonly children: React.ReactNode;
}

export function LogoutProvider({
  children,
}: LogoutProviderProps): React.JSX.Element {
  const database = useDatabase();
  const { isAuthenticated } = useAuth();
  const segments = useSegments();
  const { showToast } = useToast();
  const { t: tSettings } = useTranslation("settings");
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [hasSessionTerminated, setHasSessionTerminated] = useState(false);
  const [pendingForceSkipSync, setPendingForceSkipSync] = useState<
    boolean | null
  >(null);
  const hasStartedLogoutRef = useRef(false);
  const currentSegment = segments[0] ?? "";

  useEffect(() => {
    const isAuthRoute = currentSegment === "auth";
    if (
      !isLoggingOut ||
      pendingForceSkipSync === null ||
      !isAuthRoute ||
      hasStartedLogoutRef.current
    ) {
      return;
    }

    hasStartedLogoutRef.current = true;
    performLogout(database, pendingForceSkipSync)
      .then((result) => {
        if (result.success) {
          setHasSessionTerminated(true);
          return;
        }

        hasStartedLogoutRef.current = false;
        setIsLoggingOut(false);
        setHasSessionTerminated(false);
        setPendingForceSkipSync(null);
        showToast({
          type: "error",
          title: tSettings("logout_error"),
        });
        router.replace("/");
      })
      .catch(() => {
        hasStartedLogoutRef.current = false;
        setIsLoggingOut(false);
        setHasSessionTerminated(false);
        setPendingForceSkipSync(null);
        showToast({
          type: "error",
          title: tSettings("logout_error"),
        });
        router.replace("/");
      });
  }, [
    currentSegment,
    database,
    isLoggingOut,
    pendingForceSkipSync,
    showToast,
    tSettings,
  ]);

  useEffect(() => {
    const isAuthRoute = currentSegment === "auth";
    if (
      !isLoggingOut ||
      !hasSessionTerminated ||
      isAuthenticated ||
      !isAuthRoute
    ) {
      return;
    }

    const timeout = setTimeout(() => {
      setIsLoggingOut(false);
      setHasSessionTerminated(false);
      setPendingForceSkipSync(null);
      hasStartedLogoutRef.current = false;
    }, LOGOUT_OVERLAY_RELEASE_DELAY_MS);

    return () => clearTimeout(timeout);
  }, [currentSegment, hasSessionTerminated, isAuthenticated, isLoggingOut]);

  const requestLogout = useCallback(
    (forceSkipSync = false): void => {
      if (isLoggingOut) return;

      setIsLoggingOut(true);
      setPendingForceSkipSync(forceSkipSync);
      setHasSessionTerminated(false);
      hasStartedLogoutRef.current = false;
      router.replace("/auth");
    },
    [isLoggingOut]
  );

  const value = useMemo<LogoutContextValue>(
    () => ({
      isLoggingOut,
      requestLogout,
    }),
    [isLoggingOut, requestLogout]
  );

  return (
    <LogoutContext.Provider value={value}>
      <View style={styles.root}>
        {children}
        {isLoggingOut ? (
          <View style={styles.absoluteOverlay} pointerEvents="auto">
            <LogoutOverlay />
          </View>
        ) : null}
      </View>
    </LogoutContext.Provider>
  );
}

export function LogoutOverlay(): React.JSX.Element {
  const { t } = useTranslation("common");

  return (
    <View style={styles.overlay}>
      <View style={styles.content}>
        <ActivityIndicator size="large" color={palette.nileGreen[400]} />
        <Text style={styles.title}>{t("logging_out")}</Text>
        <Text style={styles.subtitle}>{t("logging_out_subtitle")}</Text>
      </View>
    </View>
  );
}

export function useLogout(): LogoutContextValue {
  const context = useContext(LogoutContext);
  if (!context) {
    throw new Error("useLogout must be used within a LogoutProvider");
  }
  return context;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  absoluteOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100_000,
    elevation: 100_000,
  },
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.slate[950],
    paddingHorizontal: 32,
  },
  content: {
    alignItems: "center",
    gap: 16,
  },
  title: {
    color: palette.slate[50],
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  subtitle: {
    color: palette.slate[200],
    fontSize: 15,
    fontWeight: "500",
    textAlign: "center",
  },
});
