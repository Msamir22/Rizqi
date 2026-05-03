---
description:
  React Native and TypeScript patterns specific to the Monyvi codebase. Covers
  hooks, async patterns, WatermelonDB usage, and common pitfalls.
globs: ["**/*.ts", "**/*.tsx"]
---

# React Native TypeScript Patterns

## Async Patterns

- Use `async/await` with try-catch, never raw `.then()` chains
- Narrow `unknown` in catch: `if (error instanceof Error)` — never use `any`
- Parallel independent work with `Promise.all`, not sequential `await`
- Never use `async` with `forEach` — use `for...of` or `Promise.all`

## React Hooks Rules

- `useEffect` MUST return cleanup for subscriptions, timers, listeners
- Dependency arrays must be exhaustive — no missing deps
- Never call hooks conditionally or inside loops
- Derive state during render with `useMemo`, not `useEffect` + `setState`
- `useCallback` for functions passed as props to child components

## WatermelonDB Patterns

- Use `.observe()` for reactive data in hooks, not `.fetch()` + polling
- Always unsubscribe from observations in `useEffect` cleanup
- Query at the database level with `Q.where()`, don't fetch-then-filter in JS
- Use `database.write()` for all write operations (required by WatermelonDB)
- Batch related writes in a single `database.write()` call

## Component Patterns

- Use `FlatList` with `keyExtractor` for lists > 10 items, never `.map()`
- Wrap list items in `React.memo` to prevent unnecessary re-renders
- Use `InteractionManager.runAfterInteractions()` for heavy work after
  navigation
- Clean up side effects in `useEffect` return function

## Import Patterns

- Use `import type` for type-only imports
- Named imports over default imports (tree-shaking)
- Import from package index (`@monyvi/db`) not deep paths unless necessary
