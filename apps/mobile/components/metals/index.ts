/**
 * Metals Components Barrel Export
 *
 * Re-exports all metals-related UI components for the My Metals screen.
 * Components will be added here as they are implemented in subsequent phases.
 *
 * @module metals
 */

// Phase 4 (US1): Portfolio overview
export { MetalsHeroCard } from "./MetalsHeroCard";
export { EmptyMetalsState } from "./EmptyMetalsState";

// Phase 5 (US2): Holdings by type
export { MetalTabs } from "./MetalTabs";
export type { MetalTab } from "./MetalTabs";
export { HoldingCard } from "./HoldingCard";

// Phase 6 (US3): Portfolio breakdown
export { MetalSplitCards } from "./MetalSplitCards";

// Phase 7 (US4): Live rates
export { LiveRatesStrip } from "./LiveRatesStrip";

// Phase 8 (US5): Add holding
export { AddHoldingModal } from "./AddHoldingModal";
