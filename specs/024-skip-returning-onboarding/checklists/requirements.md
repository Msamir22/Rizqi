# Specification Quality Checklist: Skip Onboarding for Returning Users

**Purpose**: Validate specification completeness and quality before proceeding
to planning **Created**: 2026-04-17 **Last Updated**: 2026-04-18 **Feature**:
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

- Terminology aligns with the codebase: "account" / "cash account" (not
  "wallet"). The onboarding steps are Language → Slides → Currency →
  Cash-account confirmation.
- Anonymous/guest auth is out of the product per
  `docs/business/business-decisions.md` (2026-03-09 decision); the spec contains
  no anonymous-account scenarios, FRs, or assumptions.
- **Flow corrected (2026-04-18)**: the onboarding flow is **four steps**, not
  three. The slides carousel (between Language and Currency) was missing from
  the earlier draft.
- **Data model fixed (2026-04-18)**: the overall `onboarding_completed` flag on
  the remote profile is the single source of truth for the routing gate
  (dedicated, not derived). Per-step signals (language set, slides-viewed,
  currency set) are used only for the resume-point decision when the flag is
  false.
- **Currency is mandatory (2026-04-18)**: the Currency step no longer exposes a
  skip affordance (FR-009). This removes the previous ambiguity around skip
  semantics and the need for a fallback currency. As a consequence, the cash
  account is always auto-created at the currency step (FR-010), and the edge
  case "flag true but no cash account" (previously Edge Case 4) has been
  dropped.
- **Language persistence (2026-04-18)**: FR-007 makes `preferred_language` a
  server-persisted field. This supersedes today's local-only (AsyncStorage)
  approach so language survives reinstall and device switch.
- **No migration required** because the app is pre-production (Assumption 5).
  Any pre-release devices with local-only language will flow through the new
  onboarding once.
- Supersedes the prior spec.md in this branch which had been committed as the
  raw template; the checklist has been re-validated against the new content.
- **Clarifications session 2026-04-18** resolved four decisions, recorded inline
  in the spec's `## Clarifications` section and the relevant FRs: (1) retry
  screen actions = Retry + Sign out (FR-006); (2) profile-fetch timeout = 20
  seconds (FR-006); (3) offline-first composition: blocking pull-sync on
  sign-in, then local-DB-authoritative (FR-001 + Assumptions + Dependencies
  investigation); (4) routing-gate observability logging (FR-014).
