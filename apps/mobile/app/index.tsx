/**
 * Public app entry point.
 *
 * This route only decides whether the user belongs in the public auth/pitch
 * flow or the authenticated startup gate. Profile, sync, onboarding, and
 * dashboard routing live under the private route group so private providers do
 * not mount during pre-auth.
 */

import { StartupLoadingView } from "@/components/ui/StartupLoadingView";
import { useAuth } from "@/context/AuthContext";
import { useIntroSeen } from "@/hooks/useIntroSeen";
import { Redirect, useRouter } from "expo-router";
import { useEffect } from "react";

export default function Index(): React.ReactNode {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const { isSeen: introSeen, isLoading: isIntroLoading } = useIntroSeen();

  if (isAuthLoading || isIntroLoading) {
    return null;
  }

  if (!isAuthenticated) {
    if (!introSeen) return <Redirect href="/pitch" />;
    return <Redirect href="/auth" />;
  }

  return <RedirectWithTransitionFallback href="/startup" />;
}

interface RedirectWithTransitionFallbackProps {
  readonly href: "/startup";
}

function RedirectWithTransitionFallback({
  href,
}: RedirectWithTransitionFallbackProps): React.ReactElement {
  const router = useRouter();

  useEffect(() => {
    router.replace(href);
  }, [href, router]);

  return <StartupLoadingView />;
}
