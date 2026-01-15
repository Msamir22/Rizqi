import { MarketRates, PreviousDayRates } from "@astik/logic";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RealtimeChannel } from "@supabase/supabase-js";
import { useEffect, useRef, useState } from "react";
import {
  getLatestMarketRates,
  getPreviousDayRates,
} from "../services/market-rates";
import { supabase } from "../services/supabase";

// Query keys for cache management
export const marketRatesKeys = {
  all: ["market-rates"] as const,
  current: () => [...marketRatesKeys.all, "current"] as const,
  previousDay: () => [...marketRatesKeys.all, "previous-day"] as const,
};

interface UseMarketRatesResult {
  rates: MarketRates | null;
  previousDayRates: PreviousDayRates | null;
  isLoading: boolean;
  error: Error | null;
  isConnected: boolean;
}

/**
 * Hook to get latest market rates with realtime updates.
 * Uses React Query for caching
 */
export function useMarketRates(): UseMarketRatesResult {
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Fetch current rates with caching
  const {
    data: rates = null,
    isLoading,
    error,
  } = useQuery({
    queryKey: marketRatesKeys.current(),
    queryFn: getLatestMarketRates,
  });

  // Fetch previous day rates with caching
  const { data: previousDayRates = null } = useQuery({
    queryKey: marketRatesKeys.previousDay(),
    queryFn: getPreviousDayRates,
    staleTime: 30 * 60 * 1000, // 30 minutes (doesn't change often)
  });

  // Set up realtime subscription for live updates
  useEffect(() => {
    const channel = supabase
      .channel("market-rates-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "market_rates",
        },
        (payload) => {
          // New rate inserted - update cache directly
          queryClient.setQueryData(
            marketRatesKeys.current(),
            payload.new as MarketRates
          );
        }
      )
      .subscribe((status) => {
        setIsConnected(status === "SUBSCRIBED");
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [queryClient]);

  return {
    rates,
    previousDayRates,
    isLoading,
    error,
    isConnected,
  };
}
