# Skeleton Loading States

## Rule

All loading states in the app MUST use the `<Skeleton>` component from
`components/ui/Skeleton.tsx`. **Never use `ActivityIndicator`** for content
loading.

## How to Use

1. **Import the Skeleton primitive:**

   ```tsx
   import { Skeleton } from "@/components/ui/Skeleton";
   ```

2. **Create screen-specific skeleton compositions** that match the actual
   content layout. This provides a more polished UX than a generic spinner.

3. **Example — card skeleton:**
   ```tsx
   function CardSkeleton(): React.ReactElement {
     return (
       <View className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800">
         <Skeleton width={120} height={16} borderRadius={4} />
         <Skeleton
           width="100%"
           height={40}
           borderRadius={8}
           style={{ marginTop: 12 }}
         />
         <Skeleton
           width={80}
           height={12}
           borderRadius={4}
           style={{ marginTop: 8 }}
         />
       </View>
     );
   }
   ```

## When ActivityIndicator IS Acceptable

- **Pull-to-refresh** (`RefreshControl`) — this is a platform standard
- **Button loading state** — inside a submit button while an action is pending
- **Initial app/database bootstrap** — before any content structure is known

## Enforcement

- Any PR introducing `ActivityIndicator` for content loading will be flagged
- Existing `ActivityIndicator` usage for content loading should be migrated to
  Skeleton compositions during the module's audit phase
