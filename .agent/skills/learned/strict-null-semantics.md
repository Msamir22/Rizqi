---
name: strict-null-semantics
description:
  Astik architectural rule for handling unselected or pending entity IDs. Never
  coerce nullable IDs to empty strings just to satisfy validation or type
  checkers.
---

# Strict Null Semantics for Entity IDs

When managing entity IDs (such as `accountId`, `categoryId`, etc.) across the
UI, state hooks, and validation layers in Astik, you must adhere strictly to the
true domain model.

## Core Directives

1. **Never use `""` (empty string) as a fallback for missing IDs.**
   - An empty string is not a valid identifier.
   - If an ID is functionally missing, unselected, or pending, its type MUST be
     `string | null` in the state and the validation payload.
2. **Embrace `null` at the validation boundary.**
   - Do not alter or hack validation signatures to accept generic strings just
     so you can pass `id ?? ""` from the client to trigger a `.min(1)` failure.
   - If an ID can technically be unselected in a form, write your validation
     logic/schema to accept `string | null` natively.
3. **Respect strict domain constraints.**
   - If an upstream domain entity (like a voice parsed transaction) guarantees
     that a field (e.g. `categoryId`) is _always_ present, do NOT type your
     React state as `string | null`.
   - Trust the domain constraint. Initialize state strictly (e.g.,
     `useState<string>(transaction.categoryId)`) instead of unnecessarily
     widening types.

## Anti-Pattern Examples

**❌ INCORRECT (Masking Types):**

```typescript
// Coercing to an empty string just to silence TypeScript for a validator
const { isValid } = validateForm({ accountId: selectedAccountId ?? "" });
```

**✅ CORRECT (Explicit Narrowing & True Nullability):**

```typescript
// 1. State accurately reflects reality
const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

// 2. Validation signature realistically accepts null
const validateForm = (data: { accountId: string | null }) => { ... }

// 3. TypeScript control flow narrows the type manually without hacky string coercions
if (!selectedAccountId) {
  setFormErrors({ accountId: "Account is required" });
  return;
}
// selectedAccountId is automatically typed as strict `string` below
submit(selectedAccountId);
```
