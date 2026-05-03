---
description: Run styling checks and common refactorings for Monyvi UI
---

# 🎨 Monyvi Styling Workflow

This workflow helps ensure that building components follow the established
styling rules:

1. Tailwind CSS first
2. Dark mode compliance (using `dark:` variant)
3. No static colors
4. Unified PageHeader usage

## Commands

### 🔍 Check for Styling Violations

// turbo

1. Run a grep search for common styling anti-patterns (static colors, isDark
   logic in styles).
   `grep -rE "isDark \?|#[0-9a-fA-F]{3,6}|rgba?\(|StyleSheet\.create" apps/mobile/app apps/mobile/components`

### 🏗️ Refactor Component to Tailwind

Use this when you find a component using `StyleSheet.create` or `isDark` logic.

1. Read the component file.
2. Identify all `StyleSheet` references.
3. Replace them with equivalent Tailwind classes.
4. Replace `isDark` ternary colors with `dark:` variants.

### 📋 UI Implementation Checklist

When creating a new screen:

- [ ] Uses `PageHeader` from `@/components/navigation/PageHeader`.
- [ ] Background uses `bg-slate-25 dark:bg-slate-900`.
- [ ] Text uses `text-slate-800 dark:text-white` (or similar slate variants).
- [ ] No static hex codes used.
- [ ] Interactive elements have proper `activeOpacity` or `Pressable` feedback.
