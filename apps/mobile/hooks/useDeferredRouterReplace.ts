import { useNavigationContainerRef, useRouter, type Href } from "expo-router";
import { useEffect } from "react";

const ROUTER_READY_RETRY_MS = 50;

interface UseDeferredRouterReplaceOptions {
  enabled: boolean;
  href: Href;
}

export function useDeferredRouterReplace({
  enabled,
  href,
}: UseDeferredRouterReplaceOptions): void {
  const router = useRouter();
  const navigationRef = useNavigationContainerRef();

  useEffect(() => {
    if (!enabled) return;

    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const replaceWhenReady = (): void => {
      if (navigationRef.isReady()) {
        router.replace(href);
        return;
      }

      timeoutId = setTimeout(replaceWhenReady, ROUTER_READY_RETRY_MS);
    };

    replaceWhenReady();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [enabled, href, navigationRef, router]);
}
