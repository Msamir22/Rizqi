import React, { useCallback } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { readIntroSeen } from "@/services/intro-flag-service";
import { PitchCarousel } from "@/components/onboarding/PitchCarousel";

export default function PitchScreen(): React.ReactElement {
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      readIntroSeen()
        .then((seen) => {
          if (seen) {
            router.replace("/auth");
          }
        })
        .catch(() => {
          // If read fails, show pitch anyway
        });
    }, [router])
  );

  return <PitchCarousel />;
}
