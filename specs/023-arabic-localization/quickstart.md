# Quickstart: Arabic Localization

**Feature**: 023-arabic-localization **Date**: 2026-04-05

## Prerequisites

- Node.js 18+
- Expo development build (RTL does NOT work in Expo Go)
- Physical device or emulator for RTL testing

## Setup Steps

### 1. Install Dependencies

```bash
cd apps/mobile
npm install i18next react-i18next @expo-google-fonts/noto-sans-arabic
```

### 2. Configure app.json for RTL

Add `supportsRTL: true` to the Expo config:

```json
{
  "expo": {
    "extra": {
      "supportsRTL": true
    },
    "plugins": ["expo-localization"]
  }
}
```

### 3. Initialize i18n

Create `apps/mobile/i18n/index.ts`:

```ts
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { getLocales } from "expo-localization";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Import all namespaces for each locale
import enCommon from "../locales/en/common.json";
import arCommon from "../locales/ar/common.json";
// ... (all namespaces)

const LANGUAGE_KEY = "@astik/language";

async function getStoredLanguage(): Promise<string> {
  const stored = await AsyncStorage.getItem(LANGUAGE_KEY);
  if (stored) return stored;
  const deviceLang = getLocales()[0]?.languageCode ?? "en";
  return deviceLang === "ar" ? "ar" : "en";
}

export async function initI18n(): Promise<void> {
  const lng = await getStoredLanguage();

  await i18n.use(initReactI18next).init({
    resources: {
      en: { common: enCommon /* ... */ },
      ar: { common: arCommon /* ... */ },
    },
    lng,
    fallbackLng: "en",
    defaultNS: "common",
    interpolation: { escapeValue: false },
  });
}

export async function changeLanguage(lang: "en" | "ar"): Promise<void> {
  await AsyncStorage.setItem(LANGUAGE_KEY, lang);
  await i18n.changeLanguage(lang);
  // RTL toggle + reload handled by caller
}
```

### 4. Add RTL Toggle Utility

Create `apps/mobile/utils/rtl.ts`:

```ts
import { I18nManager } from "react-native";
import * as Updates from "expo-updates";

export function applyRTL(isArabic: boolean): void {
  const shouldBeRTL = isArabic;
  if (shouldBeRTL !== I18nManager.isRTL) {
    I18nManager.allowRTL(shouldBeRTL);
    I18nManager.forceRTL(shouldBeRTL);
    Updates.reloadAsync();
  }
}
```

### 5. Wrap App with I18nProvider

In `_layout.tsx`, initialize i18n before rendering:

```tsx
import { initI18n } from "../i18n";
// Call initI18n() in the root layout's useEffect or before app renders
```

### 6. Use Translations in Components

```tsx
import { useTranslation } from "react-i18next";

function MyScreen(): JSX.Element {
  const { t } = useTranslation("transactions");
  return <Text>{t("add_transaction")}</Text>;
}
```

### 7. RTL-Safe NativeWind Classes

Replace directional utilities:

```tsx
// Before (LTR-only)
<View className="ml-4 pr-2 text-left" />

// After (RTL-safe)
<View className="ms-4 pe-2 text-start" />
```

## Testing

### Test Arabic Mode

1. Build development client: `npx expo run:android` or `npx expo run:ios`
2. Open Settings → change language to Arabic
3. App reloads with RTL layout and Arabic text

### Test RTL Layout

- Verify all screens mirror correctly
- Check icon positions swap (left → right)
- Verify swipe gestures are mirrored
- Check bidirectional text (Arabic with English names/numbers)

### Test Fallback

- Remove a translation key from `ar/` files
- Verify English fallback appears (not raw key)
