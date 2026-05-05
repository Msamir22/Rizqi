import { changeLanguage, type SupportedLanguage } from "@/i18n/changeLanguage";
import { setIntroLocaleOverride } from "@/services/intro-flag-service";
import { setPreferredLanguage } from "@/services/profile-service";
import { logger } from "@/utils/logger";

interface ApplyLanguageSelectionOptions {
  readonly isAuthenticated: boolean;
  readonly setUnauthenticatedOverride: (
    language: SupportedLanguage
  ) => Promise<void>;
}

/**
 * Apply a language selected from the shared language picker.
 *
 * Unauthenticated users only get the device-scoped intro override. When the
 * app believes a user is authenticated, we still write that override first so
 * an RTL reload can bootstrap in the selected language. Profile persistence is
 * best-effort here because auth/profile sync can be mid-transition on the auth
 * screen; if the profile row is not locally ready yet, the visible language
 * change must still happen.
 */
export async function applyLanguageSelection(
  language: SupportedLanguage,
  options: ApplyLanguageSelectionOptions
): Promise<void> {
  if (!options.isAuthenticated) {
    await options.setUnauthenticatedOverride(language);
    return;
  }

  await setIntroLocaleOverride(language);
  try {
    await setPreferredLanguage(language);
  } catch (error: unknown) {
    logger.warn(
      "languageSelection.profileLanguagePersist.failed",
      error instanceof Error ? { message: error.message } : { error }
    );
    await changeLanguage(language);
  }
}
