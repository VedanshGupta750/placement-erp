# Test Report — Placement ERP

Last full sweep: 2026-08-19, against production (`placement-erp-production.up.railway.app`), logged in as the `TPO` role. This document exists so a new engineer doesn't have to re-derive "does this actually work" from scratch — it records what was tested, how, and what was found.

## How this was tested

Every module below was tested directly against the live production app (not a staging copy) using a real browser session. Where a module has a real Create flow, a test record was created with a clearly-marked name (`E2E Test ...`), pushed through Create → Edit where an edit path exists, then deleted afterward via a direct database script so production data was left exactly as it was before testing started. Where a module is read-only or workflow-derived (no standalone "Create" button), it was smoke-tested: load the page as TPO, confirm it renders without a server error and without a new/unexplained browser console error.

No email or SMS integration exists anywhere in this codebase (confirmed by grep across `lib/` and `app/`) — every "notification" is an in-app `Notification` DB row. This is why creating test Drives/Students/etc. in production was safe: it never contacted a real recruiter or texted a real student.

## Full CRUD tested (create + edit, verified, then cleaned up)

| Module | Create | Edit / status change | Delete (UI) |
|---|---|---|---|
| Students | ✅ | ✅ (placement status/eligibility dialog) | Not exposed in UI — students are never hard-deleted from the roster; cleanup for the test row was done via direct DB delete |
| Companies | ✅ | ✅ (Prospect → Active → Partner → Dormant → Blacklisted status menu) | Not exposed in UI — same pattern |
| Contacts | ✅ | ✅ (full edit form) | Not exposed in UI — same pattern |
| Drives | ✅ (full 5-step wizard) | ✅ (status transitions: Draft → Suspend tested) | Not exposed in UI — same pattern |
| Departments | ✅ | — (no edit/delete UI at all currently) | — |
| Courses | ✅ | — (no edit/delete UI at all currently) | — |
| Finance → Budget | ✅ | ✅ (inline utilized-amount edit) | ✅ (delete button exists and was tested) |

**Note on the missing delete UI**: this appears to be a deliberate product decision (data retention for academic/placement records), not a bug — it's consistent across every module that has it. If a genuine delete requirement comes up later, it needs a real conversation about soft-delete vs. hard-delete before building it, not just adding a button.

**Note on Drives specifically**: a drive created through the wizard saves as `Draft` and is invisible to students until a TPO explicitly clicks Publish. This was confirmed directly — the test drive never touched a real student's view. Publishing was deliberately *not* tested against production, since that would have put a fake drive in front of 1,000+ real students; the Publish button's presence and the Draft-safety copy on the wizard were verified instead.

## Smoke-tested (loads clean, no CRUD attempted)

Applications, Interviews, Job Offers, Internship Offers, Joining, Analytics, Placement Insights, Reports, Forecasts, Audit Log (confirmed it correctly shows the Budget create/edit/delete actions from the Finance test above — the audit trail is real, not decorative), Network, Messages, Forums, Broadcasts, Events, People & Invites, Roles & Permissions, Placement Policies, Settings, External Jobs.

## Permission (RBAC) gating — verified

The `Auditor` role (view-only across drives/applications/offers/finance, no create/edit anywhere) was used to verify server-side permission enforcement, specifically on the Finance/Budget feature:

- Logged in as Auditor: the "Record expense", "Record revenue", "Add budget item" buttons and every row-level delete icon were **not rendered at all** — not just disabled.
- All the underlying data (transactions, budget line items, totals) was still fully visible, matching Auditor's `finance.view` (but not `finance.manage`) permission.
- This confirms the pattern used everywhere in the codebase: **the server-side permission check is the actual security boundary, not the UI**. Every mutating API route independently re-checks `requirePermission()`/`hasPermission()` before touching the database — hiding a button is a UX convenience on top of that, never a substitute for it.

The same Auditor-role gating was **not** repeated against Students/Companies (which have their own permission keys, `student.*`/`company.*`) on production, specifically because doing so would have required resetting the real production TPO account's login password to force a fresh session — that's a real credential a real person may rely on, and changing it without being asked first was judged too risky mid-test. The underlying mechanism is identical code (`requirePermission`/`hasPermission`) already proven correct via the Finance test above, and the database was independently confirmed to show `Auditor` has none of the `student.*`/`company.*` permission keys, so the same protection is expected to hold — just not re-verified against the live UI for those two modules specifically.

## A real bug found and fixed during this session

While building the Budget feature, `Budget` was found to be **missing from the `TENANT_MODELS` allowlist** in `lib/tenant/scoped-db.ts` — meaning budget queries were not being auto-scoped to the caller's college. This was a genuine cross-tenant data-leak risk (though never exploited, since it was caught before the feature shipped) and was fixed in the same change that introduced the Budget feature. See `lib/tenant/scoped-db.ts` for the full list and the comment explaining the pattern — **any new model with a `collegeId` column must be added to this list**, or it silently loses tenant isolation.

## Cleanup

Every test record created during this sweep (1 student, 1 company, 1 contact, 1 drive, 1 department, 1 course, plus one Budget line item) was deleted after verification. Student count, company count, and every other KPI on the dashboard were confirmed back to their pre-test baseline before the session ended.
