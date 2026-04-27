# Onboarding Restructure — Approved Mockups

**Stitch project**:
[`projects/7737349693874632909`](https://stitch.withgoogle.com/projects/7737349693874632909)
**Design doc (authoritative)**:
[`../design/slides-concepts.md`](../design/slides-concepts.md)

Saved snapshots of approved mockups for issue #246. See the design doc for full
rationale, copy, token mappings, and revision history.

## Files

| File                           | Screen                                                                     | Stitch ID                          |
| ------------------------------ | -------------------------------------------------------------------------- | ---------------------------------- |
| `01-slide-voice.png`           | Pre-auth Slide 1 — Voice (both platforms)                                  | `f7b27a492fee404c8a0fb168c723ff6b` |
| `02a-slide-sms-android.png`    | Pre-auth Slide 2 — SMS (Android only)                                      | `b485c0d266a942088cfe43b92a8c9341` |
| `02b-slide-offline-ios.png`    | Pre-auth Slide 2 — Offline (iOS only, content-dense v2)                    | `17e56eb8bd754b2197eedada5f1069ee` |
| `03-slide-live-market.png`     | Pre-auth Slide 3 — Live Market (both platforms)                            | `63a1b5af14e44361bac3acb7e9ac194b` |
| `04-auth-light.png`            | Auth screen (light, with trust microbar footer + top border)               | `b253bc436f5748c1b656acc836a83a93` |
| `05-tooltip-cash-account.png`  | First-run cash-account tooltip                                             | `6cfe0ada329b429b814eca794f9cd840` |
| `06-tooltip-mic-button.png`    | First-run mic-button tooltip (v3 — centered layout, X close, "Try it now") | `31bd0663de0f45268edd28c1122c2dfe` |
| `07-onboarding-guide-card.png` | Updated OnboardingGuideCard (4 steps, expanded state)                      | `013bca359d2645fa9a10ea9d0b7d80cb` |

## Platform divergence

- **Slide 2** is the only platform-divergent slide. Android shows SMS
  (`02a-slide-sms-android.png`); iOS shows Offline
  (`02b-slide-offline-ios.png`). Slide count is 3 on both platforms.
- All other mockups apply to both platforms equally.

## Dark mode

Not included. Applied at implementation time via NativeWind `dark:` variants per
the dark-mode token table in the design doc.

## Implementer notes

- **Mic tooltip**: the mockup's mic button is centered in the tab bar to match
  the shipped app. Tooltip anchors to the real centered position.
- **Google OAuth icon on auth screen**: preserve the current icon from the
  existing `SocialLoginButtons` component; do not copy the mockup's Google logo
  styling.
- **Button label "Try it now"** on mic tooltip: dismiss + open voice. **X close
  icon**: dismiss only.
- **Cash-account tooltip**: body is single-sentence only. Do not include "Delete
  it from Settings if you don't need it."
- **OnboardingGuideCard step 3 label**: the mockup shows "Enable SMS
  auto-import" but the shipped label is **"Auto-track bank SMS"** (finalized
  2026-04-23 for clarity — "SMS auto-import" is jargon). The mockup was not
  regenerated for this copy change — the spec's FR-022 is authoritative.
