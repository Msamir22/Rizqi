import { useEffect, useState } from "react";
import { readIntroSeen } from "@/services/intro-flag-service";
import { logger } from "@/utils/logger";

/**
 * Observes the device-scoped intro-seen flag.
 *
 * Contract: `isLoading` MUST transition from `true` to `false` after the
 * initial AsyncStorage read, regardless of success or failure. If the read
 * rejects (corrupt storage, native bridge hiccup), the hook defaults to
 * `isSeen = false` so the routing gate shows the pitch rather than the user
 * being stuck on a splash / blank screen forever.
 */
export function useIntroSeen(): {
  readonly isSeen: boolean;
  readonly isLoading: boolean;
} {
  const [isSeen, setIsSeen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async (): Promise<void> => {
      try {
        const value = await readIntroSeen();
        if (!cancelled) {
          setIsSeen(value);
        }
      } catch (error: unknown) {
        logger.warn(
          "useIntroSeen.readFailed",
          error instanceof Error ? { message: error.message } : { error }
        );
        // Fall through to the finally block: default `isSeen = false`.
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { isSeen, isLoading };
}
