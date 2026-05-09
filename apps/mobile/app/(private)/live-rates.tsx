/**
 * Live Rates Screen — Expo Router Entry
 *
 * Displays real-time precious metal and fiat currency exchange rates.
 * Uses custom header (headerShown: false) via LiveRatesScreen component.
 *
 * @module live-rates
 */

import { LiveRatesScreen } from "@/components/live-rates";
import { Stack } from "expo-router";
import React from "react";

export default function LiveRatesRoute(): React.JSX.Element {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <LiveRatesScreen />
    </>
  );
}
