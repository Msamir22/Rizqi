# Monyvi Mobile App

Expo React Native app for Monyvi.

All dependencies are managed from the root workspace. Run commands from the
repository root unless noted otherwise.

## Running The App

```bash
# Start Expo dev server
npm run mobile

# Run on iOS
npm run mobile:ios

# Run on Android
npm run mobile:android
```

For Android SMS testing, use a development build rather than Expo Go because the
app relies on native SMS permissions and the generated SMS broadcast receiver.

## Tech Stack

- Expo SDK 52
- React Native 0.76
- Expo Router
- NativeWind
- WatermelonDB
- Supabase Auth, sync tables, and Edge Functions
- Gemini-powered voice and SMS parsing
- Sentry
- i18next with English and Arabic resources

## Feature Areas

- Public pitch and mandatory auth flow
- Authenticated startup gate and onboarding currency step
- Dashboard, accounts, transactions, stats, and metals tabs
- Live rates for gold, silver, and roughly 35 currencies
- Inflation rate tracking and guidance
- Manual transaction and transfer entry
- Voice transaction review flow
- SMS batch scan, live detection, notifications, and review
- Budgets and recurring payments
- Settings for language, theme, currency, SMS detection, and logout

## Important Docs

- [Business decisions](../../docs/business/business-decisions.md)
- [Technical architecture](../../docs/architecture/technical-architecture.md)
- [Design system](../../docs/design/design-system.md)
- [Constitution](../../.specify/memory/constitution.md)
