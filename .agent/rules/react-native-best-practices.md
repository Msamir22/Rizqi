---
trigger: model_decision
description: when working on mobile app that uses react native
---

- Use the latest version of React Native for performance and stability.
- Leverage native modules for performance-critical tasks.
- Optimize images and assets for mobile to reduce load times.
- Use Flexbox for responsive layouts across different screen sizes.
- Type all `props` and `state` using interfaces.
- Use `React.FC<Props>` only when you need `children`; otherwise use
  `function Component(props: Props)` for better type inference.
- Use `StyleSheet.create()` to define styles and type them accordingly.
- Avoid inline styles unless necessary for dynamic styling.
- Use `TouchableOpacity`, `Pressable`, or `TouchableWithoutFeedback` instead of
  `Button` for better UI control.
- Avoid logic in JSX; move calculations outside the return statement.
- Always use `FlatList` instead of mapping manually over arrays when rendering
  long lists.
- Use `useMemo` and `useCallback` to avoid unnecessary re-renders in
  performance-critical components.
- Use `keyExtractor` in `FlatList` to prevent key warnings and improve rendering
  efficiency.
- Always clean up side effects in `useEffect` with a return function (cleanup).
- Prefer `react-native-safe-area-context` and `KeyboardAvoidingView` to manage
  safe areas and keyboard overlap.

  ## Component Structure & Organization
  - Each component should live in its own file.
  - Keep components small and focused (Single Responsibility Principle).
  - Use a dedicated folder structure: `/components`, `/screens`, `/hooks`,
    `/types`, `/utils`, `/constants`, `/services`.
  - Create reusable styled components or hooks where patterns repeat.
  - Use `index.ts` for barrel exports in folders.

  ## Async & APIs
  - Always use `async/await` with try/catch for API calls.
  - Extract API logic into separate service files.
  - Use `zod` or similar libraries for runtime validation of API responses.
  - Use `React Query`, `SWR`, or similar libraries for stateful data fetching
    and caching.

  ## Testing & Debugging
  - Write unit tests using `Jest` and `@testing-library/react-native`.
  - Mock native modules and API responses in tests.
  - Prefer `detox` for end-to-end testing if applicable.

instructions:

- Follow all rules above when writing or refactoring React Native TypeScript
  code.
- Ensure proper typing and code organization.
- Optimize for performance and memory usage on mobile devices.
- Use idiomatic React Native patterns and avoid web-specific patterns unless
  React Native Web is used.
- Provide reusable, clean, and accessible component implementations.
- Favor scalability, testability, and maintainability in all implementations.
