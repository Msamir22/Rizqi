---
name: android-modal-overlay-pattern
description: >
  Fix for Android Modal layout collapse with NativeWind v4. Use
  absolute-positioned overlay (StyleSheet.absoluteFillObject) instead of React
  Native Modal component when Modal content collapses to (0,0) on Android.
---

# Android Modal/Overlay Pattern

## Problem

React Native's `<Modal>` component frequently causes **layout collapse on
Android** when used with NativeWind v4. Symptoms include:

- Modal content renders at position (0, 0) with zero dimensions
- Only fixed-size elements (e.g., toggle switches with explicit `w-12 h-7`) are
  visible; all other content is invisible
- The dark backdrop never appears
- `flex: 1` and `justifyContent: "flex-end"` have no effect inside the Modal

### Known Triggers

1. **`bg-color/opacity` classes on `Pressable` or `TouchableOpacity`** inside a
   Modal (e.g., `bg-black/40` on `Pressable`) — this is a documented NativeWind
   v4 race condition
2. **Parent `<View className="flex-1">` wrapping** — the Modal inherits broken
   layout constraints from the parent flex container
3. **NativeWind `className` on Views inside Modal** — styles may not resolve
   correctly in the Modal's separate native window on Android

### What Does NOT Fix It

- Switching from `Pressable` to `TouchableWithoutFeedback + View`
- Using inline `style` instead of `className`
- Moving the Modal outside the parent View using Fragment
- Matching the exact pattern of other working Modals (e.g., DeleteAccountSheet)
- **Upgrading to NativeWind 4.2.3** (tested — race condition persists)

## Solution: Absolute-Positioned Overlay

Replace `<Modal>` with an absolute-positioned `<View>` overlay using
`StyleSheet.create` (not `className`):

```tsx
const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
});

// Usage — conditionally render when visible
{
  visible && (
    <View style={styles.overlay}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
        {/* Sheet content */}
      </View>
    </View>
  );
}
```

### Key Rules

1. **Use `StyleSheet.create`** for ALL overlay styles — avoid `className`
   entirely inside the overlay to prevent NativeWind interference
2. **Use `StyleSheet.absoluteFillObject`** — ensures the overlay covers the full
   screen
3. **Set `zIndex: 999`** — ensures the overlay sits above all other content
4. **Conditionally render** — return nothing when `visible` is false (no unmount
   overhead like Modal)
5. The overlay component must be a **direct child of the page's root View** (not
   buried inside ScrollView or other containers)

## Confirmed Root Cause — NativeWind CSS Interop Race Condition

GitHub Issue [#1536](https://github.com/nativewind/nativewind/issues/1536)
documents the exact root cause:

> NativeWind's CSS interop layer causes a **race condition** during render.
> Certain utility classes trigger runtime CSS parsing that delays context
> initialization — silently breaking layout and navigation.

### Dangerous Classes (Trigger Race Condition)

- `shadow-*` (e.g., `shadow-sm`, `shadow-md`)
- `opacity-*` (e.g., `opacity-50`)
- `bg-color/opacity` shorthand (e.g., `bg-black/40`, `bg-white/15`)
- `text-color/opacity` shorthand (e.g., `text-white/80`)

### Why It's Context-Dependent

The race condition is **timing-based** — it works sometimes and fails randomly:

- The same Modal pattern works in one screen but fails in another
- The bug appears/disappears with hot reload vs full reload
- Moving code around sometimes "fixes" it (by changing render timing)

### Related GitHub Issues

- [#1536](https://github.com/nativewind/nativewind/issues/1536) — CSS Interop
  race condition (EXACT match to our bug)
- [#799](https://github.com/nativewind/nativewind/issues/799) — Modal breaks
  fonts on other screens
- [#1637](https://github.com/nativewind/nativewind/issues/1637) — Modal breaks
  on NativeWind v5

## When Modal Still Works

Not all Modals are broken. The following patterns continue to work:

- `ConfirmationModal` — centered dialog, uses `className` on `View` (not
  `Pressable`), tested across many screens
- `DeleteAccountSheet` — bottom sheet in `edit-account.tsx`, uses
  `TouchableWithoutFeedback + View` with `className`
- `CategorySelectorModal` — inside `BudgetForm`'s `ScrollView`, works fine

The issue is context-dependent due to the race condition timing. The same Modal
pattern may work in one screen but fail in another.

## Reference Implementation

See `BudgetActionsSheet.tsx` for a complete working example using the absolute
overlay approach.
