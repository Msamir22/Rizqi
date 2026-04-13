# Module Audit

Perform a comprehensive deep audit of a module/feature in the Astik app. This
analysis framework is standardized across all modules to ensure consistent
quality before release.

## Usage

```bash
/module-audit <module-name>
```

Example: `/module-audit accounts`, `/module-audit transactions`,
`/module-audit settings`

## Instructions

You are performing a comprehensive audit of the **$ARGUMENTS** module in the
Astik app. Follow each section below systematically.

### 1. Identify Scope

First, identify ALL files belonging to this module:

- Screens (`apps/mobile/app/`)
- Components (`apps/mobile/components/`)
- Hooks (`apps/mobile/hooks/`)
- Services (`apps/mobile/services/`)
- Shared logic (`packages/logic/src/`)
- Database models (`packages/db/src/models/`)
- Types and schemas

### 2. Bugs & Broken Functionality (Priority: P0-P2)

Check for:

- Non-functional buttons (missing `onPress` handlers)
- Missing navigation handlers
- Wrong data displayed or calculated
- Unhandled null/undefined states
- Broken conditional rendering
- Missing error handling in async operations
- Platform-specific issues (Android Modal bug, etc.)

### 3. Calculation Correctness

For EVERY calculation function:

- Check for division by zero
- Check for `undefined` field access without `?? 0` fallback
- Check for `parseFloat` without `isNaN` guard
- Check for NaN propagation through math operations
- Verify `Number.isFinite()` guards on external data
- Check percentage calculations sum to 100% (use largest remainder method)
- Check currency conversion with missing rates
- Verify test coverage exists

### 4. Styling Audit

Per CLAUDE.md rules:

- No static hex colors (`#FFFFFF`, `rgb(...)`) — must use `palette` from
  `@/constants/colors`
- No `isDark` ternary for background/text colors — use `dark:` Tailwind variant.
  **Exception**: component props that accept color values (e.g.,
  `<Icon color={isDark ? '#fff' : '#000'} />`)
- Use reusable global.css classes (`.header-text`, `.subtitle-text`,
  `.body-text`, `.body-small`, `.caption-text`, `.button-text`, `.input-label`,
  `.input-error`) where appropriate
- Consistent spacing between sections
- Dark mode coverage on all elements
- RTL support (use `me-`/`ms-` instead of `ml-`/`mr-`)
- SafeArea handling (no hardcoded padding)
- No NativeWind shadow classes on `TouchableOpacity`/`Pressable`

### 5. Performance

Check for:

- `React.memo` on components that receive props
- `useCallback` on functions passed as props to children
- `useMemo` on expensive computations
- No inline objects/arrays in JSX (extract to constants or useMemo)
- `InteractionManager.runAfterInteractions()` for heavy work after navigation
- `FlatList` with `keyExtractor` for lists > 10 items (not `.map()`)
- Proper `useEffect` cleanup for subscriptions
- WatermelonDB: `.observe()` for reactive data, `Q.where()` for filtering

### 6. Code Quality (SOLID/DRY)

- Duplicated patterns that should be extracted
- SRP violations (components doing too much)
- Business logic in components (should be in hooks/services)
- File length (<400 lines typical, 800 max)
- Function length (<50 lines)
- No `any` types — narrow `unknown` in catch blocks
- Explicit return type annotations on all functions
- `import type` for type-only imports

### 7. UX Evaluation

- Information hierarchy (most important info most prominent)
- Cognitive load (too many actions visible at once?)
- Action discoverability (can user find all features?)
- Empty states (what shows when data is missing?)
- Loading states (must use `<Skeleton>` component, NOT `ActivityIndicator`)
- Error states (graceful degradation, retry options)
- Touch targets (min 44x44 points)
- Navigation clarity (user always knows where they are)

### 8. Architectural Review

- Data flow (props drilling? should use context?)
- Error boundaries (one buggy section shouldn't crash the whole screen)
- Lazy loading opportunities
- State management (local vs context vs global)
- Service layer separation (hooks for subscriptions, services for DB writes)

### 9. i18n Gaps

- Any hardcoded strings not in translation files?
- Check both `en/*.json` and `ar/*.json` for missing keys
- Verify RTL layout works

### 10. Product Ideas

- AI integration opportunities
- Features that reduce manual entry
- Features that make the module faster/easier to use
- Egyptian market-specific improvements

## Output Format

Present findings as a structured plan with:

| #   | Issue | File | Severity | Action |
| --- | ----- | ---- | -------- | ------ |

Group by section (Bugs, Calculations, Styling, etc.)

Include an **Implementation Order** at the end, prioritized by:

1. P0 bugs (broken functionality)
2. P1 bugs (wrong behavior)
3. Calculation fixes
4. Performance
5. Code quality
6. Styling
7. UX polish

Include a **Key Files to Modify** section listing all files that need changes.
