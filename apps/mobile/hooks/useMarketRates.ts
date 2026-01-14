import { MarketRates, PreviousDayRates } from "@astik/logic";
import { RealtimeChannel } from "@supabase/supabase-js";
import { useEffect, useRef, useState } from "react";
import {
  getLatestMarketRates,
  getPreviousDayRates,
} from "../services/market-rates.service";
import { supabase } from "../services/supabase";

interface UseMarketRatesResult {
  rates: MarketRates | null;
  previousDayRates: PreviousDayRates | null;
  isLoading: boolean;
  error: Error | null;
  isConnected: boolean;
}

/**
 * Hook to get latest market rates with realtime updates.
 * Also fetches previous day rates for trend comparison.
 */
export function useMarketRates(): UseMarketRatesResult {
  const [rates, setRates] = useState<MarketRates | null>(null);
  const [previousDayRates, setPreviousDayRates] =
    useState<PreviousDayRates | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    const fetchInitialRates = async (): Promise<void> => {
      try {
        setIsLoading(true);
        const result = await getLatestMarketRates();
        setRates(result);
        setError(null);
      } catch (err) {
        console.error("Error fetching initial rates:", err);
        setError(
          err instanceof Error ? err : new Error("Failed to fetch rates")
        );
      } finally {
        setIsLoading(false);
      }
    };

    const fetchPreviousDayRates = async (): Promise<void> => {
      const result = await getPreviousDayRates();
      setPreviousDayRates(result);
    };

    fetchInitialRates();
    fetchPreviousDayRates();

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
          // New rate inserted - update state
          console.log("🔄 Market rates updated via realtime:", payload.new);
          setRates(payload.new as MarketRates);
        }
      )
      .subscribe((status) => {
        // Track connection status
        setIsConnected(status === "SUBSCRIBED");
        if (status === "SUBSCRIBED") {
          console.log("✅ Subscribed to market rates realtime updates");
        } else if (status === "CHANNEL_ERROR") {
          console.error("❌ Failed to subscribe to market rates");
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        console.log("🔌 Unsubscribing from market rates realtime");
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, []);

  return {
    rates,
    previousDayRates,
    isLoading,
    error,
    isConnected,
  };
}
