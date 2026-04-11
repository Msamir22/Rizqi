/**
 * Market Rates Realtime Provider
 *
 * Owns the Supabase Realtime channel subscription for market rates.
 * Lives at the app-root provider level so the WebSocket connection persists
 * across screen navigations, eliminating the 30-40s re-subscribe delay that
 * occurs when the channel is torn down and re-created on every mount.
 *
 * Architecture & Design Rationale:
 * - Pattern: Context Provider (app-level singleton)
 * - Why: The realtime channel is a shared resource. Multiple hooks
 *   (`useMarketRates`, `useLiveRatesScreen`, etc.) depend on `isConnected`,
 *   but none should own the channel lifecycle. Lifting to a provider ensures
 *   a single persistent connection.
 * - SOLID: SRP — manages only the channel lifecycle and connection state.
 *   DIP — consumers depend on the context abstraction, not the Supabase SDK.
 *
 * @module MarketRatesRealtimeProvider
 */

import {
  REALTIME_SUBSCRIBE_STATES,
  type RealtimeChannel,
} from "@supabase/supabase-js";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../services/supabase";
import { useSync } from "./SyncProvider";

// =============================================================================
// Types
// =============================================================================

interface MarketRatesRealtimeContextValue {
  /** Whether the realtime channel is actively subscribed */
  readonly isConnected: boolean;
}

// =============================================================================
// Context
// =============================================================================

const MarketRatesRealtimeContext =
  createContext<MarketRatesRealtimeContextValue | null>(null);

// =============================================================================
// Provider
// =============================================================================

interface MarketRatesRealtimeProviderProps {
  readonly children: ReactNode;
}

export function MarketRatesRealtimeProvider({
  children,
}: MarketRatesRealtimeProviderProps): React.JSX.Element {
  const { isAuthenticated } = useAuth();
  const { sync } = useSync();
  const [isConnected, setIsConnected] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Stable reference to sync so the channel callback doesn't cause re-subscribes
  const syncRef = useRef(sync);
  useEffect(() => {
    syncRef.current = sync;
  }, [sync]);

  const handleInsert = useCallback((): void => {
    syncRef.current().catch(console.error);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      // Tear down channel when logged out
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        setIsConnected(false);
      }
      return;
    }

    const channel = supabase
      .channel("market-rates-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "market_rates",
        },
        handleInsert
      )
      .subscribe((status) => {
        setIsConnected(status === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED);
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        setIsConnected(false);
      }
    };
  }, [isAuthenticated, handleInsert]);

  const value = useMemo<MarketRatesRealtimeContextValue>(
    () => ({ isConnected }),
    [isConnected]
  );

  return (
    <MarketRatesRealtimeContext.Provider value={value}>
      {children}
    </MarketRatesRealtimeContext.Provider>
  );
}

// =============================================================================
// Hook
// =============================================================================

/**
 * Access the market-rates realtime connection state.
 *
 * @throws if used outside `MarketRatesRealtimeProvider`
 */
export function useMarketRatesRealtime(): MarketRatesRealtimeContextValue {
  const context = useContext(MarketRatesRealtimeContext);
  if (!context) {
    throw new Error(
      "useMarketRatesRealtime must be used within a MarketRatesRealtimeProvider"
    );
  }
  return context;
}
