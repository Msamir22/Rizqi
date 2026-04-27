/**
 * MicButtonRefContext
 *
 * Exposes a ref to the tab-bar mic button so anchored overlays (e.g.
 * `MicButtonTooltip`) can measure its position on screen. The ref itself is
 * created inside `MicButtonRefProvider` via `useRef` and forwarded into the
 * `CustomBottomTabBar` component, which attaches it to the rendered button.
 *
 * ## Outside-of-provider behavior
 *
 * Unlike `FirstRunTooltipContext`, this hook INTENTIONALLY returns `null`
 * when used outside the provider instead of throwing. The mic-button tooltip
 * renders as a top-level dashboard child and is legitimately mounted before
 * the tab layout (and its provider) becomes ready. Graceful degradation —
 * "no ref yet → render nothing" — is the correct semantics; see
 * `MicButtonTooltip.tsx` for the defensive check.
 *
 * If you need strict "provider required" semantics, create a new context
 * wrapper rather than changing this one.
 */

import React, { createContext, useContext, useRef } from "react";
import type { View } from "react-native";

const MicButtonRefContext = createContext<React.RefObject<View> | null>(null);

export function MicButtonRefProvider({
  children,
}: {
  readonly children: React.ReactNode;
}): React.ReactElement {
  const micRef = useRef<View>(null);
  return (
    <MicButtonRefContext.Provider value={micRef}>
      {children}
    </MicButtonRefContext.Provider>
  );
}

export function useMicButtonRef(): React.RefObject<View> | null {
  return useContext(MicButtonRefContext);
}
