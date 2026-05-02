/**
 * Private Data Boundary
 *
 * Clears in-memory private app data and remounts authenticated state when the
 * active user changes. This complements logout's WatermelonDB reset by closing
 * the runtime window where stale screens or caches could expose old data.
 *
 * @module PrivateDataBoundary
 */

import React, { useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { queryClient } from "./QueryProvider";
import { logger } from "@/utils/logger";

interface PrivateDataBoundaryProps {
  readonly children: React.ReactNode;
}

export function PrivateDataBoundary({
  children,
}: PrivateDataBoundaryProps): React.JSX.Element {
  const { user } = useAuth();
  const userKey = user?.id ?? "signed-out";
  const previousUserKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const previousUserKey = previousUserKeyRef.current;

    if (previousUserKey === null) {
      previousUserKeyRef.current = userKey;
      return;
    }

    if (previousUserKey !== userKey) {
      try {
        queryClient.clear();
      } catch (error: unknown) {
        logger.warn(
          "privateDataBoundary.queryCacheClear.failed",
          error instanceof Error ? { message: error.message } : { error }
        );
      }
      previousUserKeyRef.current = userKey;
    }
  }, [userKey]);

  return <React.Fragment key={userKey}>{children}</React.Fragment>;
}
