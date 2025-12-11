# Astik Mobile App - Quick Start Guide

## Prerequisites

1. **Install Expo Go on your phone:**
   - iOS: [App Store](https://apps.apple.com/app/expo-go/id982107779)
   - Android:
     [Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent)

## Running the App

### From Project Root:

```bash
# Start Expo
npm run mobile

# Or specifically:
npm run mobile:ios      # iOS only
npm run mobile:android  # Android only
```

### From Mobile Directory:

```bash
cd apps/mobile
npx expo start
```

## What You'll See:

1. Terminal shows QR code
2. Scan with:
   - **iOS**: Camera app → Opens in Expo Go
   - **Android**: Expo Go app → Scan QR
3. App loads on your phone!

## Current Features:

✅ **Dashboard Screen**

- Egyptian theme (Nile Green #065F46)
- Total balance card
- Quick action buttons (Voice + Manual)
- Floating mic button
- Tab navigation

✅ **Tab Navigation**

- Dashboard (Home)
- Transactions
- Accounts

## Troubleshooting:

**"Couldn't find app.json"**

- Make sure you're in `/apps/mobile` directory
- Or use `npm run mobile` from root

**"Missing assets" warnings**

- Assets are optional for development
- Check `assets/README.md` for details

**QR code not scanning**

- Try pressing 'w' for web preview
- Or press 'a' for Android emulator / 'i' for iOS simulator

## Next Steps After Running:

1. Test voice input button (UI only for now)
2. Navigate between tabs
3. Check theme colors
4. Test on your phone!

## Development:

Edit files in `apps/mobile/app/` - Expo will auto-reload!
