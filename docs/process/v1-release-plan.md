# v1.0 Release Plan

**Status**: Approved 2026-04-29. Source of truth for v1.0 sprint cadence, daily
routine, and working agreements. Update this file (not your local notes) when
the plan changes — every contributor and AI agent reads from here.

**Public ship deadline**: Tue 2026-10-20 (set on the GitHub `v1.0` milestone).
Internal target: code-complete by Fri 2026-09-25, RC build in TestFlight + Play
Internal Testing by then.

---

## Constraints

- **Owner role**: planning, reviewing logic & code, directing AI agents. AI
  writes 90%+ of the implementation; capacity is bound by review and direction,
  not typing.
- **Schedule**: 6 days/week (Sat–Thu, Friday off), 4–6 hrs/day.
- **Throughput**: 2–3 reviewed/merged PRs per working day (target 2.5).
- **Sprint shape**: 2-week sprints, 35% buffer for unplanned bugs/features.
- **Scope discipline**: keep all v1.0 issues unless cuts are made explicitly at
  a sprint review.

---

## Capacity Math

```
Working days/month  = 6 days/week × 4.33 wks/mo  ≈ 26
Reviewed PRs/day    = 2.5 (midpoint of 2–3)
Total PRs/month     = 26 × 2.5                    = 65
Planned share (65%) = 65 × 0.65                   ≈ 42 PRs/mo
Buffer share (35%)  = 65 × 0.35                   ≈ 23 PRs/mo

2-week sprint = 12 working days × 2.5 PRs/day     = 30 PRs/sprint
  → 20 planned + 10 unplanned per sprint
```

11 sprints (1 hardening + 1 release + 9 module sprints) + Sprint 0 (triage +
rebrand) + 11-day contingency = lands on Tue 2026-10-20.

---

## Sprint Schedule

| Sprint      | Dates                           | Theme                                                                                     |
| ----------- | ------------------------------- | ----------------------------------------------------------------------------------------- |
| 0           | Wed 2026-04-29 → Thu 2026-05-07 | Triage 54 unmilestoned issues + rebrand (rename, new logo, brand pack, mechanical rename) |
| 1           | Sat 2026-05-09 → Fri 2026-05-22 | Accounts module — foundation                                                              |
| 2           | Sat 2026-05-23 → Fri 2026-06-05 | Transactions core (voice, AI, security)                                                   |
| 3           | Sat 2026-06-06 → Fri 2026-06-19 | Transactions polish + Recurring start                                                     |
| 4           | Sat 2026-06-20 → Fri 2026-07-03 | Recurring close + Budgets                                                                 |
| 5           | Sat 2026-07-04 → Fri 2026-07-17 | Stats + Metals start _(mid-flight checkpoint)_                                            |
| 6           | Sat 2026-07-18 → Fri 2026-07-31 | Metals close + Dashboard v2 start _(beta cohort + store accounts due)_                    |
| 7           | Sat 2026-08-01 → Fri 2026-08-14 | Dashboard v2 deep work                                                                    |
| 8           | Sat 2026-08-15 → Fri 2026-08-28 | Dashboard v2 polish                                                                       |
| 9           | Sat 2026-08-29 → Fri 2026-09-11 | Dashboard v2 close + cross-module                                                         |
| 10          | Sat 2026-09-12 → Fri 2026-09-25 | Cross-cutting hardening + bug bash _(code-freeze)_                                        |
| 11          | Sat 2026-09-26 → Fri 2026-10-09 | Release: store submission, beta soak                                                      |
| Contingency | Sat 2026-10-10 → Tue 2026-10-20 | 11 days reserved for store-review fixes / late critical bugs                              |

---

## Daily Routine

| Block                  | Duration  | Activity                                                          |
| ---------------------- | --------- | ----------------------------------------------------------------- |
| Morning standup (solo) | 15 min    | Read overnight CI / agent outputs. Pick top 2–3 issues for today. |
| Review block 1         | 60–90 min | Review 1 PR end-to-end (logic + style).                           |
| Direction block 1      | 30–45 min | Brief 1–2 agents on next issues.                                  |
| Review block 2         | 60–90 min | Review another PR — typically smaller / cross-cutting.            |
| Triage / planning      | 20–30 min | Sprint board update, label new bugs, clarifying issues.           |
| Direction block 2      | 30–60 min | Kick off next batch of agents to run while user is offline.       |

**Daily PR target**: 2–3 reviewed AND merged. **Weekly cadence**: ~15 PRs (12
planned + 3 unplanned), 1 sprint planning/retro at sprint boundary.

---

## Working Agreements

1. **No new v1 scope without a trade**. Every new "must-have" forces an explicit
   bump of an existing v1 item to v1.1 — otherwise the date slips.
2. **Critical bugs preempt the sprint plan.** A new `priority: critical` v1 bug
   jumps the queue and consumes buffer.
3. **Sprint review at end of each sprint** (15 min): planned vs actual closes,
   buffer consumption %. If buffer consumed > 50% for two consecutive sprints,
   re-forecast and consider scope cuts.
4. **Module-by-module exit gate**: a module is v1-ready only when all its
   critical + high issues are closed AND its `area: <module>` filter shows zero
   open `priority: critical` items.
5. **Code freeze for v1.0** = end of Sprint 10 (Fri 2026-09-25). After that,
   only bugfixes for items already filed against v1.0; everything else goes to
   v1.1.

---

## Mid-flight Checkpoints

| When                          | Check                                                                                                                                                       | Trigger                                                          |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| End of Sprint 0 (2026-05-07)  | Rebrand done, repo renamed, app boots, GitHub Project live                                                                                                  | If no, Sprint 1 starts late and the date slips.                  |
| End of Sprint 5 (2026-07-17)  | ≥ 80 issues closed in v1.0                                                                                                                                  | If < 60, re-forecast in writing; if 60–79, consider scope cut.   |
| End of Sprint 6 (2026-07-31)  | Beta cohort onboarded ([#537](https://github.com/Msamir22/Monyvi/issues/537)); store accounts ready ([#538](https://github.com/Msamir22/Monyvi/issues/538)) | If no, Sprint 11 release window shrinks and date is at risk.     |
| End of Sprint 9 (2026-09-11)  | Zero open `priority: critical` in v1.0                                                                                                                      | If no, hardening sprint is at risk; defer non-criticals to v1.1. |
| End of Sprint 10 (2026-09-25) | Code-complete; ≤ 5 open `priority: high`; build in TestFlight + Play Internal                                                                               | If no, ship date slips.                                          |
| End of Sprint 11 (2026-10-09) | Public availability submitted in both stores                                                                                                                | If no, contingency window absorbed.                              |
| 2026-10-20                    | Public availability live OR ≤ 72 hr from store approval                                                                                                     | Hard deadline.                                                   |

---

## Risks (current)

1. **Compressed Sprint 0** (8 days for triage + rebrand). Logo + trademark
   clearance are the long poles. Fallback: ship Sprint 1 with a "v0 logo"
   placeholder if final isn't approved by Day 5 (Mon 2026-05-04); trademark
   check continues in the background.
2. **35% buffer may be tight for fintech + AI-heavy workflow.** Revisit after
   Sprint 2 — if buffer was consumed at >40%, raise to 40% and accept consuming
   some contingency days at the end.
3. **No swing sprint** (sacrificed for the rebrand). Mid-flight checkpoint at
   Sprint 5 must be honoured strictly.
4. **Beta cohort & store accounts must be ready by end of Sprint 6** — tracked
   via [#537](https://github.com/Msamir22/Monyvi/issues/537) and
   [#538](https://github.com/Msamir22/Monyvi/issues/538).

---

## Tracking Issues

- [#93](https://github.com/Msamir22/Monyvi/issues/93) — Sprint-0 rebrand
  (rename + logo + brand pack)
- [#537](https://github.com/Msamir22/Monyvi/issues/537) — Beta cohort
  recruitment & onboarding (Sprint-6 gate)
- [#538](https://github.com/Msamir22/Monyvi/issues/538) — Store accounts &
  submission readiness (Sprint-6 gate)
- [#257](https://github.com/Msamir22/Monyvi/issues/257) — Dashboard v2
  release-readiness epic (will be split into 7 sub-area tracking issues during
  Sprint 0)
- [#268](https://github.com/Msamir22/Monyvi/issues/268),
  [#371](https://github.com/Msamir22/Monyvi/issues/371),
  [#408](https://github.com/Msamir22/Monyvi/issues/408),
  [#411](https://github.com/Msamir22/Monyvi/issues/411),
  [#467](https://github.com/Msamir22/Monyvi/issues/467),
  [#491](https://github.com/Msamir22/Monyvi/issues/491) — module audit epics
  (Transactions, Accounts, Budgets, Recurring, Metals, Stats)

---

## Verification commands

```bash
# Daily merge check
gh pr list --state merged --search "merged:>=$(date -I)"

# Weekly closed-issue check
gh issue list --milestone v1.0 --state closed \
  --search "closed:>=$(date -I -d '7 days ago')"

# Critical-open check (run at end of Sprint 9)
gh issue list --milestone v1.0 --label "priority: critical" --state open

# High-open check (run at end of Sprint 10)
gh issue list --milestone v1.0 --label "priority: high" --state open
```

---

## Follow-ups (separate planning sessions)

- **Automated agent-team workflow**: scrum-master / QA / DevOps personas,
  scheduled tasks per workflow event, sprint-review automation. To be planned in
  a fresh session and committed as `docs/process/agent-team-workflow.md` once
  approved.
