# Specification Quality Checklist: Skip Onboarding for Returning Users

**Purpose**: Validate specification completeness and quality before proceeding
to planning **Created**: 2026-04-17 **Last Updated**: 2026-04-18 (second pass —
simplified data model; per-step progress moved to AsyncStorage) **Feature**:
[spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- Terminology aligns with the codebase: "account" / "cash account" (never
  "wallet").
- Anonymous auth is out of the product per `docs/business/business-decisions.md`
  (2026-03-09 decision); no anonymous scenarios appear in the spec.
- **Flow is 4 steps**: Language → Slides → Currency → Cash-account confirmation.
- **Single DB-level gate**: `profiles.onboarding_completed` (existing column,
  authoritative).
- **One new DB column**: `profiles.preferred_language` (enum
  `preferred_language_code`, non-null, default `'en'`).
- **Per-step progress is AsyncStorage-only**, keyed by userId
  (`onboarding:<userId>:step`). Confirmed 2026-04-18 — simplification from the
  earlier DB-based design.
- **Currency is mandatory** (FR-009): no skip affordance on the Currency step.
- **Legacy AsyncStorage keys deleted** (FR-015): `HAS_ONBOARDED_KEY` and
  `LANGUAGE_KEY` removed from `constants/storage-keys.ts` and all consumers.
- **Retry screen mockup approved** (Variant 2 "Status Card") — assets at
  `specs/024-skip-returning-onboarding/mockups/`.
- **Out of scope** for this feature (filed as separate issues 2026-04-18):
  sign-out during onboarding happy path →
  [#242](https://github.com/Msamir22/Rizqi/issues/242); back/forward navigation
  between steps → [#243](https://github.com/Msamir22/Rizqi/issues/243).
- **Pre-production status** (Assumption 5): no migration strategy for legacy
  AsyncStorage users; they flow through the new onboarding once.
