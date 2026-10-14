# Subdomain architecture & change log

Target deployment: **one codebase, many colleges, one subdomain per college**
(`iitb.yourapp.com`, `nitk.yourapp.com`, …), plus a separate host for the
platform/superuser console.

This document covers (1) what the code does today, (2) what must be built
before subdomains are real, and (3) everything changed in this work session.

---

## 1. Current state — subdomains are NOT wired up

**Nothing in the application reads the request hostname.** There is no
`middleware.ts`, no host lookup, nowhere.

Tenancy is resolved **entirely from the session JWT**:

```
User signs in  →  JWT carries { sub: userId, collegeId, roleId }
Every query    →  getTenantDb(session.collegeId)
```

### What this means

If an IIT-B TPO opens `nitk.yourapp.com` and signs in, they get
**IIT-B's data rendered on NITK's subdomain**. The subdomain is decoration,
not an isolation boundary — while every college, auditor and student will
assume that it is one.

### What already exists and helps

| Thing | Status |
|---|---|
| `College.slug` | ✅ exists, `@unique` — the natural subdomain key |
| `College.status` | ✅ exists; `/api/auth/login` already blocks `SUSPENDED` |
| Cookies scoped host-only | ✅ no `domain` set, so sessions don't cross subdomains |
| Host → college resolution | ❌ **missing** |
| Session/host mismatch check | ❌ **missing** |
| Platform console host gate | ❌ **missing** |

---

## 2. What must be built

### 2.1 Host → college middleware (the foundation)

A `middleware.ts` that, for every request:

1. Reads the host (`x-forwarded-host` when behind a proxy, else `host`).
2. Strips the app's root domain to get the subdomain label.
3. Looks up `College.slug === label`.
4. If no college matches → 404 (an unknown subdomain must not render the app).
5. If a session exists and `session.collegeId !== resolvedCollege.id`
   → clear the session and redirect to that host's sign-in.

Point 5 is the actual isolation boundary. Without it the subdomain means
nothing.

Reserve these labels so a college can never take them:
`www`, `api`, `admin`, `app`, `platform`, `mail`, `static`, `assets`.

### 2.2 Platform console host gate

Because the same build runs everywhere, `/platform/sign-in` currently
exists on **every college subdomain**:

```
iitb.yourapp.com/platform/sign-in    ← superuser login
nitk.yourapp.com/platform/sign-in    ← the same superuser login
rcoem.yourapp.com/platform/sign-in   ← and again
```

One superuser door multiplied by the number of colleges. Every one of them
is brute-forceable and discoverable.

**Fix:** an env var naming the single host allowed to serve it.

```
PLATFORM_HOST=admin.yourapp.com
```

Middleware returns **404** (not 403) for `/platform/*` and `/api/platform/*`
on any other host, so the console does not advertise its own existence.

```
admin.yourapp.com/platform   →  200
iitb.yourapp.com/platform    →  404
```

**Do not fork the codebase for the admin console** — that guarantees drift
in shared code.

### 2.3 Deployment topology

| Option | How | Trade-off |
|---|---|---|
| **A — one deployment, host-gated** | `admin.yourapp.com` points at the same app; middleware allows the console only there | Simplest, one deploy to keep in sync. Admin shares a process with tenant traffic. |
| **B — same image, two services** | Deploy the identical build twice. Tenant service leaves `PLATFORM_HOST` unset (console 404s everywhere); admin service sets it. | Same code, no drift, and the admin service can sit behind a VPN or IP allowlist so it is not on the public internet. |

**Recommendation:** build the host gate now (needed either way), start with
**A**, move to **B** when you want network-level lockdown. No code changes
are needed to switch.

### 2.4 Cookie warning

Session cookies currently set **no `domain`**, so they are host-only:
a session on `admin.yourapp.com` is never sent to `iitb.yourapp.com`.
This is correct.

> **Never set `domain: ".yourapp.com"`** to "share login across subdomains".
> That makes every session valid on every college's subdomain — including
> the superuser session.

Relevant files: `lib/auth/session.ts`, `lib/auth/company-session.ts`,
`lib/auth/platform-session.ts`.

### 2.5 Implementation checklist

- [ ] `middleware.ts` — host → college resolution
- [ ] Reject session/host mismatch
- [ ] 404 unknown subdomains
- [ ] `PLATFORM_HOST` gate for `/platform/*` and `/api/platform/*`
- [ ] Reserved subdomain blocklist
- [ ] Subdomain (slug) management in the console: change slug, redirect old
- [ ] Wildcard DNS `*.yourapp.com` + wildcard TLS certificate

---

## 3. Superuser console — what exists vs. what is still needed

### Built

- Separate login at `/platform/sign-in`, own 12-hour session, own cookie
- Console at `/platform`: all colleges, user counts
- Create a college (roles, campus, department, batch, first TPO)
- Reset a college's TPO password
- CLI to create the first admin (no web route, by design)
- Full audit trail of operator actions + cross-college activity feed

### Still needed (priority order)

1. **Subdomain management** — change a college's slug; today it is generated
   once at provisioning and can never change.
2. **Suspend / reactivate a college** — `College.status` exists and login
   already blocks `SUSPENDED`; it only needs a button.
3. **Per-college usage dashboard** — students, drives, applications, offers,
   **storage used**, last activity, active users.
4. **Plan limit enforcement** — `maxStudents` (500 / 3000 / 20000) is defined
   in `lib/billing/plans.ts` and every college gets a `TRIALING`
   subscription, but **nothing enforces either**. A 500-student trial can
   import 50,000 students and the trial never expires.
5. **Reset any user's password** — currently TPO only.
6. **Support impersonation** — read-only, time-boxed, audited, with a banner.
7. **Force sign-out** — blocked on session revocation (see §5).
8. **Per-college data export** — offboarding and DPDP Act requests.
9. **Background job visibility** — the push worker and two cron endpoints
   have no status surface; a silent cron failure is invisible.

---

## 4. Changes made in this session

### 4.1 Features completed (were built but never wired up)

| Feature | What was wrong | Fix |
|---|---|---|
| **Eligibility overrides** | API, permission and table existed, but no UI created one **and the engine never read the override table** | Engine now applies overrides after the rule tree; new UI with student search, force in/out, mandatory reason, revoke endpoint, and a candidate-pool guard |
| **Company Notes** | Panel fully written, never mounted; no code could read notes back | Added a Notes tab that renders them |
| **Delete contact** | Button written, never mounted — contacts could not be deleted at all | Mounted on the detail page **and** added to each list row |
| **`/dev-preview/network`** | Throwaway QA harness marked "deleted before hand-off"; returned **200 unauthenticated** | Removed |

### 4.2 Security and correctness

- **TPO permission grant** — every TPO was granted the full permission
  catalog, including the four platform-only keys (`api.create`,
  `api.revoke`, `billing.view`, `billing.manage`) that
  `lib/rbac/permissions.ts` explicitly says must never go to a college role.
  Now granted `COLLEGE_PERMISSION_KEYS` only.
  Cleanup script: `npm run platform:revoke-perms` (supports `--dry-run`).
  **Applied: 12 grants removed across 3 colleges.**
- **Roles API hole** — the `/roles` *page* hid api/billing permissions but
  the API behind it did not check. A hand-crafted `PATCH` could grant
  `billing.manage` to any role. Now filtered server-side.
- **Public signup removed** — `/sign-up` and `/api/auth/signup` had **no
  authentication**: anyone could create a college and become its TPO.
  Both deleted; colleges are now created only from the operator console.
- **Type-to-confirm deletes** — new reusable `ConfirmDeleteDialog` requiring
  the word `DELETE` to be typed, replacing a one-click browser confirm.

### 4.3 Superuser (platform) layer — new

| File | Purpose |
|---|---|
| `lib/auth/platform-session.ts` | Own cookie, 12h; re-reads the admin row every request so deleting an account revokes access immediately |
| `app/api/platform/auth/login|logout` | Rate-limited, enumeration-safe (identical error for unknown email and wrong password) |
| `app/api/platform/colleges` | List + create |
| `app/api/platform/colleges/[id]/reset-tpo` | Recovery for a locked-out college |
| `app/platform/*`, `components/platform/*` | Sign-in page and console |
| `scripts/create-platform-admin.ts` | `npm run platform:create-admin -- <email> "<name>" [password]` — also the lockout recovery path |

Verified: signed-out access 307s to sign-in, API returns 401, a **TPO session
cannot reach the platform API and a platform session cannot reach tenant
pages**.

### 4.4 Audit, logging, monitoring — new

- **`PlatformAuditLog` table** (migration `20260921000000_add_platform_audit_log`).
  Separate from `AuditLog` because that model requires a `collegeId` and a
  tenant `User` as actor — a platform admin is neither, and a failed login
  has no college. **No FK to `PlatformAdmin`** and `actorEmail` is stored
  denormalized, so deleting an operator cannot erase what they did.
  Captures: `platform.login`, `platform.login_failed`, `platform.logout`,
  `platform.college_created`, `platform.tpo_password_reset`.
- **Tenant auth auditing** — `auth.login`, `auth.login_failed`, `auth.logout`
  now written to `AuditLog` with IP and user agent.
  Two limits, both forced by the schema: a failed login for an **unknown
  email** cannot be stored (no `collegeId`), and **recruiter** sign-ins have
  no single college. Both go to the structured log instead.
- **Cross-college activity feed** in the console — the only place in the app
  that reads `AuditLog` across tenants, with per-college filters.
- **`/api/health`** — unauthenticated liveness/readiness probe. `SELECT 1`
  against the database; **200** when serving, **503** when the DB is
  unreachable so a load balancer pulls the instance. Returns only a verdict
  and latency, never schema or error text.
- **`lib/logger.ts`** — structured JSON on stdout/stderr, `LOG_LEVEL`
  controlled, with key-based redaction
  (`pass|secret|token|cookie|jwt|hash` → `[redacted]`).
- **`instrumentation.ts`** — Next.js `onRequestError` hook catches every
  uncaught server error, plus `unhandledRejection` / `uncaughtException`.
  No vendor SDK: add Sentry/Datadog in `register()` and forward from
  `onRequestError`; nothing else changes.

### 4.5 Data correctness

- **"Placed" meant two different things.** Overview and Analytics derived it
  from offers (3 placed); the Students page read `Student.placementStatus`
  (0 placed, 40 unplaced) — a column **nothing in the offer lifecycle ever
  updated**. Fixed with a hybrid in `lib/students/placement.ts`: `PLACED` is
  always derived from offers; `SEEKING` / `NOT_INTERESTED` / `OPTED_OUT`
  still come from the column, because no offer can express those.
  All four call sites now share one definition.
- **Opportunities badge** never decreased. It counted every open drive
  matching the student's course and never excluded ones already applied to
  — and ran a query whose result was discarded. Now counts only drives the
  student can still act on, and includes `REGISTRATION_OPEN`.
- **Overrides now take effect immediately** rather than waiting for a
  re-publish, and the student's own eligibility page honours them (it
  previously ignored overrides entirely, so a forced-in student still saw
  "Not eligible").

### 4.6 UI

- Tab strips scrolled **vertically** on five detail pages (`flex-wrap`
  fighting the component's fixed height). Now scroll horizontally.
- `?tab=` deep links on the drive page, e.g.
  `/drives/<id>?tab=eligibility`.
- Stat cards: labels were sliced mid-word, then ellipsised. Icon moved to
  its own row so labels get full card width; all grids capped at **4 per row**.
- Resume and position dropdowns showed a raw `cuid` — Base UI's
  `SelectValue` renders the raw value unless given a render function.
- New **"Evaluated students"** panel listing eligible/not-eligible students
  by name with the exact rule each failed.
- Branding: the PDF disclaimer and the sign-in subtitle now follow `.env`
  instead of being hardcoded.

---

## 4bis. Changes made in the follow-up sessions

_2026-09-27 to 2026-10-02 · last updated 2026-10-02 00:23 IST_

### 4bis.1 Applicant screening filters

`app/(dashboard)/applications/page.tsx` gained **company**, **min/max CGPA**,
**min 10th/12th**, **placement status** and an explicit **"Exclude
already-placed students"** checkbox. `placed` is always derived from a
placing offer via `lib/students/placement.ts`, never from the
`Student.placementStatus` column.

Applicants who already hold an offer now carry a `Placed · <Company>` badge
rather than being hidden — a placed student applying elsewhere is a policy
question the TPO should see. A **CGPA** column and a **Resume** link were
added to the same table.

Verified against live data: 78 unfiltered → `placed` 10 + `unplaced` 68
partitions exactly; `companyId` counts match the database per company.

### 4bis.2 Eligibility roster

`components/drives/eligibility-results-panel.tsx` gained chips for
**Eligible, not applied** and **Applied**, an **Exclude placed** toggle with
a live count, filters for **min/max CGPA, max backlogs, course and
overridden-only**, and a CSV **Export** that emits exactly the filtered rows
(UTF-8 BOM so Excel doesn't mangle names).

Manual overrides became **multi-select**: one decision and one reason can
now cover a whole cohort. The API accepts `studentIds[]` and is
**all-or-nothing** — if any student is outside the drive's candidate pool the
entire request is rejected and nothing is written.

### 4bis.3 Company-level eligibility

New `components/companies/eligibility-tab.tsx`, deliberately grouped **by
drive** rather than rolled into one company-wide figure: eligibility is
defined per drive, so a company running two drives with different cut-offs
has two different eligible populations.

### 4bis.4 Resumes

The chain `Application.resumeId → Resume → File.dataUrl` was always wired,
but **40 of 41 seeded resumes had no File**, so every TPO-facing link showed
the "not downloadable" fallback.

- `prisma/seed-pdf.ts` builds a valid one-page PDF (correct xref/trailer);
  the seed now creates a real `File` per resume.
- `scripts/backfill-resume-files.ts` repairs databases seeded earlier. Only
  touches `fileId IS NULL`, so genuine uploads are never overwritten. Run
  once: 40 repaired, 41/41 now downloadable.
- Resume links added to the drive **Applicants** panel and the Applications
  table; new `GET /api/drives/[id]/resumes` returns every applicant's resume
  as a ZIP, named by enrollment number, with a `_missing-resumes.txt`
  manifest rather than silently dropping anyone.

### 4bis.5 Student-raised academic corrections

New `AcademicChangeRequest` model + migration
`20260929000000_add_academic_change_requests`.

Students **cannot** edit CGPA or backlogs — verified: the profile API strips
academic keys, and `/api/students/[id]/backlogs` and `/semester-results`
return 403 for a student session. Instead they raise a **request**
(CGPA / live backlogs / dead backlogs, reason required, one pending request
per field). The record only changes when staff **approve** it, from the
student's own Academic tab. Approval writes the value, stamps
`academicsVerifiedAt` — the first code in the app to use that long-dormant
column — records the approver's name, notifies the student and writes an
audit row.

### 4bis.6 Email, set-password and self-service reset

The app previously had **no email provider at all**. Invites and imports
generated a password and discarded it in the same line, so bulk-imported
accounts had a password nobody had ever seen; `/forgot-password` was a
static page telling students to phone the placement cell.

- `lib/email/send.ts` — one seam, driver chosen by `EMAIL_DRIVER`:
  `log` (default, writes to `.mail/`, nothing leaves the machine),
  `smtp` (college mail host, SES SMTP, Resend, Postmark), `noop` for CI.
- `PasswordResetToken` model + migration
  `20260929120000_add_password_reset_tokens`. Only the SHA-256 **hash** is
  stored. `SET_PASSWORD` lives 72h, `RESET_PASSWORD` 2h.
- New `/forgot-password` form, `/set-password` page, and
  `POST /api/auth/forgot-password` + `GET|POST /api/auth/set-password`.
- Invite, single-add and bulk import now email a **set-password link**
  instead of surfacing a password; the temp password is only returned when
  no mail provider is configured.
- `ChangePasswordDialog` was mounted **only in the staff branch** of the
  profile page — students had no way to change their own password despite
  the API allowing it. Now mounted in the student view too.

Verified: identical responses for registered and unregistered addresses
(no enumeration), only the real address produced mail, weak passwords
rejected, token single-use, old password stops working, rate limit trips on
the 6th request.

### 4bis.7 Starter password and forced first-login change

Email is built but not yet delivering (see §4bis.6), so students needed a way
in that does not depend on it.

- `User.mustChangePassword` + migration `20260929150000_add_must_change_password`.
- `lib/auth/default-password.ts` — a TPO-created student starts with their
  **enrollment number** as the password. Deliberately per-student rather than
  one shared college-wide value: a shared password opens *every* account that
  hasn't been used yet, an enrollment number opens exactly one, and the
  student already knows theirs so nothing has to be communicated.
  `DEFAULT_STUDENT_PASSWORD` overrides it with a fixed value if preferred.
- The `(dashboard)` layout redirects to `/first-password` while the flag is
  set, so **no part of the app loads** until it is replaced — the starter
  password is usable exactly once. The page sits outside that layout group so
  it can render without looping.
- The endpoint refuses the starter password as the replacement, and a TPO
  "Reset password" re-arms the flag.

### 4bis.8 One-time academic self-entry

The same first-login screen collects **10th %, 12th %, overall CGPA and
semester-wise SGPA** from students. That window is gated on
`mustChangePassword`, so it genuinely closes after one use — verified: a
second attempt returns 400 and leaves the values untouched.

Entered values are written to the Student row and `StudentSemesterResult`,
visible immediately to staff, but **`academicsVerifiedAt` is deliberately NOT
stamped** — they are self-declared until someone checks them. Afterwards a
student can only propose changes through `AcademicChangeRequest` (§4bis.5).

The form carries an explicit notice to fill in only what applies and only
figures backed by a marksheet, and states that it can be entered once.

### 4bis.9 Board scores are editable by staff

`PATCH /api/students/[id]` has always accepted `tenthScore`, `twelfthScore`,
`diplomaScore` and `aggregate` behind `student.view_sensitive`, but the
Academic tab rendered them read-only. Added `BoardScoresEditor` — the
control was missing, not the capability. Add-student also gained 10th/12th
fields (client, schema and storage).

### 4bis.10 Notification and badge corrections

- **`SelectValue` showed raw cuids** instead of names in the Add-student
  dialog. Base UI renders the raw value unless given a render function; the
  three selects now map value → label. Dialog overflow fixed at the same time.
- **Notifications were working all along** — the API returned the correct
  `unreadCount` for the TPO. Two things made them look broken: the bell polled
  only every 60s (now 20s, and it also refreshes on window focus), and the
  academic-request notification linked to the student's **Overview** tab, so
  clicking it landed nowhere near the request. The student page now accepts
  `?tab=` and the notification deep-links to `?tab=academic`.
- **Opportunities badge** was a permanent tally of open drives, so viewing
  never changed it. Now unread-style via `Student.opportunitiesSeenAt`
  (migration `20260929170000_add_opportunities_seen_at`); opening the list
  marks it seen.

### 4bis.11 Academic request panel corrections

- **Stale value across field types.** The "Correct value" box kept its number
  when the field type changed, so `9.2` entered as a CGPA stayed put after
  switching to "Live backlogs" while the hint below it changed to "a whole
  number" — the number and the rule contradicting each other on screen. The
  value now clears on field change and after a successful submit. The server
  had always rejected it (`400`, whole-number rule), so nothing invalid could
  be stored; it was purely a confusing form.
- **Missing space** in "1 request isawaiting review" — the sentence was split
  across a JSX expression and a line break. Rebuilt as one string.
- **Unbounded growth.** Both request lists now scroll (`max-h-56`) instead of
  stretching the card forever. On the TPO side only the *reviewed* history
  scrolls tightly; pending items get a taller cap, because those need
  actioning and hiding them behind a scroll works against the reviewer.

Discoverability, after a request sat unnoticed:

- **Academic tab trigger** carries an amber pending count, visible from the
  tab strip without opening the tab.
- **Students sidebar item** carries the total pending count across all
  students, so the queue is visible without opening anyone.

These are **pending counts, not read/unread**: a request that has been seen
but not actioned still needs the reviewer, so the badge clears on
approve/reject rather than on view. The general read/unread system (§5, item
11) is still the separate, unbuilt piece.

### 4bis.12 Multi-batch (graduating year) support

Batches were modelled correctly from the start — `Batch` unique per
`(collegeId, year)`, students and drives both carry a `batchId`, and
`lib/eligibility-runner.ts` resolves candidates with
`where: { batchId: drive.batchId, ... }`. Creating and populating a 2027 or
2028 cohort already worked.

**But drives could not target one.** Both `app/api/drives/route.ts` and
`app/api/drives/import/route.ts` did:

```ts
db.batch.findFirstOrThrow({ orderBy: { year: "desc" } })
```

Every new drive silently attached to the **highest batch year**, with no
picker anywhere. Harmless with a single batch; wrong the moment a second
exists — a drive meant for 2026 would land on 2027 and evaluate zero
candidates, with nothing on screen explaining why. A 2027 batch already
existed in the database, so this was live, not theoretical.

Fixed:

1. **Batch selector on the new-drive form**, defaulting to the batch the user
   is working in (the header switcher), *not* the newest year. Server
   resolution order: explicit `batchId` → active batch → newest.
2. **`batchYear` column in the drive import template**, resolved per row and
   falling back to the batch chosen on the import screen. An unknown year now
   errors instead of silently using the wrong cohort, and an import with no
   batches at all fails with a clear message rather than throwing.
3. **Batch shown on the drive page header** (`Company · JOB · Batch 2026`)
   and under each title in the drives list.
4. **Batch selector on the student import screen**, applied to any row that
   leaves `batchYear` blank — the column is now optional, so a
   single-cohort sheet needn't repeat it on every line. A value in the CSV
   always wins.

Duplicate-drive already copied `source.batchId` and needed no change.

Verified: an explicit 2027 drive landed on 2027; a drive created with no
`batchId` while the active context was 2026 landed on **2026** despite 2027
being newer; a student imported with no `batchYear` and the selector set to
2027 landed in 2027.

### 4bis.13 Roles reachable from the invite form — 2026-10-01

Four of the eight roles could never be assigned: the invite form sent only
`{name, email, userType}`, and the role was derived from the type
(Student / Faculty / Management / Placement Coordinator). **College Admin,
TPO, Department Coordinator and Auditor were unreachable**, which the
database confirmed — only TPO and Student had any users.

- Added a **Role** select beside Type. Changing Type still moves Role to that
  type's default, so the common case stays one click; the override is there
  when it isn't.
- **Security:** `roleId` arrived from the client and was written onto the user
  with **no validation** — not even a check that the role existed. It is now
  resolved through the tenant-scoped client first, so an id from another
  college falls through to the default. Verified: inviting with another
  college's Auditor id produced `Faculty @ Shri Ramdeobaba`, not the foreign
  role.
- Picking the Student *role* now warns that Invite creates a login with **no
  student record**, pointing to Students → Add student instead.

### 4bis.14 Select triggers showed raw cuids — 2026-10-01

Base UI's `SelectValue` renders the **raw value** unless given a render
function, so every select bound to an id displayed a cuid
("cmu5gsvcu0095…" instead of "Data Analyst Recruitment"). A scan found **38
such selects**: Add to drive, Add application, broadcasts, every filter
panel, bulk-action bars, the event wizard.

Fixed once in `components/ui/select.tsx` rather than at 38 call sites: the
`Select` wrapper walks its own children, collects each `SelectItem`'s
value → label, and `SelectValue` resolves it automatically. It traverses the
**React element tree, not the DOM** — popup items are not mounted until the
menu opens, but they exist as elements the whole time, so the trigger shows
the right label on first paint. Call sites that pass their own render
function are unaffected, and already-readable values ("PLACED") still render
as before. The wrapper had to stay generic (`<Value, Multiple>`) or
`onValueChange` lost its inference everywhere.

### 4bis.15 Add Application dialog crashed — 2026-10-01

`Cannot read properties of undefined (reading 'map')` the moment a drive was
picked. The dialog fetched `/api/drives/picker`, which returns only
`{id, title, companyName, isTemplate}` — that route exists for the
Duplicate-drive dropdown. There is no `positions` key in it, so
`selectedDrive.positions.map()` threw. TypeScript could not catch it: the
component's `Drive` type claims `positions`, but `fetch().json()` is `any`.

Repointed to `/api/drives`, whose own comment reads "Active drives +
positions for pickers". That also fixes a permission mismatch — the picker
requires `drive.create`, while adding an application requires
`application.approve`, so a user with one and not the other got a silent
empty dropdown. Added `positions ?? []`, a 403 message and an empty-state
message so it can never fail silently again.

### 4bis.16 Resumes readable in place — 2026-10-01

A TPO could only download a resume. Added `FilePreviewDialog`: an overlay
that renders the PDF inline, with download kept as a secondary action.
Mounted on the student's Skills & Resume tab, the drive Applicants panel,
the Applications table and the application detail page — screening 60
candidates no longer means 60 files in Downloads.

Chrome refuses to render a `data:` URL for a PDF in an iframe, so the stored
data URI is converted to a **blob URL** on open and revoked on close.

### 4bis.17 Reopening a closed drive — 2026-10-01

`REGISTRATION_CLOSED` was a dead end: the only moves were Mark complete and
Suspend.

Adding a status flip alone would have shipped a broken feature.
`/api/applications` rejects on **two** independent checks — `drive.status`
**and** `registrationClosesAt`. Flipping only the status produces a drive
that appears open, lists under Opportunities, and refuses every application
with "registration has closed". The drive used for testing had a deadline
four days in the past, so this was not hypothetical.

Reopening therefore always replaces the deadline (empty clears it, meaning
"open until closed by hand"). Gated on `drive.publish`, not `drive.close` —
closing and un-closing are not the same authority. Students are notified with
wording specific to reopening, and the trail records `REGISTRATION_REOPENED`
rather than a generic status change.

Verified end to end: close → reopen → **a student successfully applied**,
which the old deadline would have blocked.

### 4bis.18 Deleting a department — 2026-10-01

Department relations behave three different ways, and a plain delete would
have hit all three badly:

| Relation | On delete |
|---|---|
| `Drive.departmentId` | required → the database **refuses** |
| `Student.departmentId` | optional → students **silently unassigned** |
| memberships, course links | cascade → destroyed |

So the endpoint refuses when drives exist, with a reason, rather than letting
a raw foreign-key error surface as a 500; reports how many students will be
unassigned, both before and after; and audits the counts. Verified: a
department with 11 drives returned 409 and survived; an empty one deleted; a
department holding one student deleted with the **student record intact and
simply detached**.

### 4bis.19 PWA and responsive corrections — 2026-10-02

**iOS cannot render a PDF in an iframe.** The resume preview above would have
shown a blank box on iPhone and iPad, including the installed PWA. It now
detects iOS when the dialog opens and offers the system viewer instead.
Detection happens in the open handler, not during render, to stay SSR-safe.

**Action rows overflowed on phones.** Every list page pushed its primary
button off the right edge — Add Company, Create Drive, Add Application, Add
Student, New contact. Two variants: a plain non-wrapping `flex` (clipped
outright), and an `overflow-x-auto` strip (reachable only by a sideways swipe
most people never try). Six pages now wrap. The same pattern was swept app
wide; the Shortlisting and Rounds per-applicant action rows were fixed too.

**Stat cards disagreed.** `companies` and `drives` waited until 640px for a
second column while `applications`, `offers`, `interviews` and `students`
used `min-[360px]`, so a phone showed one card per row on some pages and two
on others. Now consistent.

Also tightened: the first-login academic inputs (three across was ~100px each
on a 390px screen), the semester SGPA rows, and the preview dialog's phone
gutter.

**Confirmed unaffected:** the base Dialog already caps to the viewport with
`overflow-y-auto`, the base Table already scrolls horizontally, and the
service worker skips `/api/` entirely — so nothing added this session is
cached or served stale.

> **Not verified:** none of §4bis.19 was checked in a real browser at real
> viewport sizes — the Chrome extension was not connected. The fixes address
> bugs proven by screenshots plus a code-wide sweep for the same pattern, but
> the app is **not** confirmed across devices. Dialogs and detail pages are
> the most likely places something still breaks.

---

### 4bis.20 Students could apply with no resume — 2026-10-14

A student with no resume at all could apply to every drive, and the form
said so out loud: *"you can still apply, or add one from the Resumes page
first."* Both sides were permissive — `resumeId` was optional in
`createApplicationSchema`, and the route only validated a resume **if one
was sent**. Three such applications already existed in the dev database.

An application with no resume is dead on arrival: there is nothing for the
company to screen, and the drive-wide resume ZIP silently skips the student.

Now required in three places:

| Layer | Rule |
|---|---|
| `createApplicationSchema` | `resumeId` required, with a written message rather than Zod's "expected string, received undefined" |
| `POST /api/applications` | resume must exist, belong to the caller, **and have a `File` behind it** |
| `ApplyForm` | no usable resume → the form is replaced by an explanation and a link to Resumes; the Apply button never renders |

The `fileId` check matters: `Resume.fileId` is nullable and
`scripts/expand-college-data.ts` created rows without one, so "has a resume"
and "has a resume a recruiter can open" are different questions. The
opportunity page now filters on `fileId: { not: null }` too, so a file-less
row is treated as no resume and sends the student to re-upload.

The picker is pre-selected only when the student has exactly **one** resume.
With several, they choose deliberately rather than having whichever row is
flagged default sent to a company silently.

Staff-side routes are deliberately unchanged — `/api/applications/add`,
`/api/students/[id]/applications` and the bulk add-to-drive action are
explicit TPO overrides and do not go through this schema.

Verified against the running app as a student: no `resumeId` → 400; empty
string → 400; another student's resume → 400; a resume with no file → 400;
own valid resume → **200 with the resume attached and a `ResumeUsage` row**.
The no-resume empty state and the filtered picker were both confirmed in
rendered HTML.

### 4bis.21 Suspending and deleting students in bulk — 2026-10-14

Suspension existed for one student at a time, buried in the detail page's
overflow menu. There was no delete at all, and no way to act on a group.

**Bulk suspend / reactivate.** Two new actions on `/api/students/bulk`.
These flip `User.status`, which is what the login route checks — deliberately
*not* `Student.placementStatus`, which is placement policy on a separate
axis (a suspended account can still be `PLACED` in the records). One audit
entry per student, not one for the batch: "was this person's access cut off,
and when" has to be answerable per student. Reactivation notifies each
student; suspension deliberately does not.

**Delete.** New `student.delete` permission, granted to TPO and College
Admin only. The coordinator roles keep `student.edit` without it on purpose
— correcting a record and erasing one are different levels of trust.
Existing colleges need `npm run db:backfill-student-delete-perm` (already
run here; new permissions only auto-grant to newly-provisioned colleges).

The mechanics live in `lib/students/delete.ts`, because deleting a student
is not one delete:

| Relation | Handling |
|---|---|
| all 16 `Student` relations | `onDelete: Cascade` — the database removes them |
| `Student.user` | `Cascade`, so deleting the **User** deletes the Student |
| `ForumPost.author`, `ForumReply.author` | required → **deleted**; the student's own words go with them |
| `Forum.createdBy` | required → **reassigned** to the acting staff member |
| `Conversation.createdById` | required → **deleted** with its messages |

It has to be the User row that goes. Deleting only the Student would leave a
`userType: STUDENT` account that can still sign in but whose every page
resolves `student.findUnique(...)` to null. And the forum/conversation rows
are required relations, so Prisma's default `Restrict` blocks the delete
until they are dealt with — the forum is reassigned rather than deleted
because deleting it would cascade away **every other student's posts inside
it**. Anything unanticipated surfaces as a foreign-key error, which both
callers turn into a plain 409 ("suspend the account instead") rather than a
500 and a half-deleted person.

Audit entries are written **before** the delete: afterwards there is no row
to point at, so that entry is the only remaining record of who was removed
and what went with them.

**Confirmation.** Both delete paths use the existing type-to-confirm
`ConfirmDeleteDialog`, and fetch exact counts first
(`/api/students/[id]/deletion-impact`, `/api/students/bulk/deletion-impact`)
so the warning reads "this also permanently deletes 1 application, 2
documents" instead of a vague caution. Counts are fetched *before* the
dialog opens, so it never renders with placeholder numbers.

Verified end to end against the running app, on three disposable students:

- bulk suspend 3 → all `SUSPENDED`, and a suspended student's login returned
  **403 `account_disabled`**
- bulk reactivate 3 → all `ACTIVE`, 3 notifications, login worked again
- single delete, on a student holding an application, a forum they created, a
  post, a reply, and a conversation → student **and user** row gone,
  application gone, their post and its replies gone, **the forum survived and
  is now owned by the TPO**, another student's post inside that forum
  survived, their conversation gone
- bulk delete 2 → both students and both user rows gone
- RBAC: a student calling delete, bulk delete, bulk suspend or the impact
  endpoint got **403** on all four; a **Placement Coordinator** (has
  `student.edit`, not `student.delete`) got **403** on all four; the target
  row survived every attempt

> **Not verified in a browser:** the dropdown item, the bulk bar buttons and
> the "Select all N" shortcut are client-rendered on open, so they do not
> appear in server HTML and the Chrome extension was not connected. The props
> reach the client (`canDelete: true`) and every endpoint behind them is
> verified above, but the click paths themselves were not exercised.

> **Pre-existing inconsistency, not introduced here:** bulk suspend requires
> `student.bulk_update`, which Placement and Department Coordinator do not
> hold, while single-student suspend needs only `student.edit`, which they
> do. So those roles can suspend one student but not many. That follows the
> existing RBAC matrix; worth a decision either way.

---

### 4bis.22 The TPO decides what "Eligible" means — 2026-10-14

The roster's Status column read `Student.eligibleForPlacements` directly, and
that column defaults to `true`. So a student with a live backlog and a 7.06
CGPA showed **Eligible**, and the CGPA / 10th / 12th / Backlogs columns
printed beside it fed into nothing. 45 of 49 students were flagged eligible;
6 of them had live backlogs. The only way the badge ever said otherwise was a
human unticking a box.

Settings → **Eligibility** now carries a college-wide policy: minimum CGPA,
minimum 10th %, minimum 12th %, maximum live backlogs, and a "treat a missing
figure as a fail" switch. Every threshold is nullable — blank means *don't
check this*, which is a different rule from a threshold of 0 (and 0 live
backlogs is a real, common rule).

**How the two layers combine.** `eligibleForPlacements = false` is a hard
block and always wins: a staff member deliberately excluded that student and
no policy should quietly re-admit them. `true` means *not blocked* — the
policy then decides. With the policy off (the default) `true` keeps meaning
plain "eligible", so nothing changes for an existing college until a TPO
turns it on. No extra column was needed to tell "never touched" from
"deliberately allowed", because both should defer to the policy anyway.

**It actually bites.** The policy is enforced in `POST /api/applications`,
not merely rendered — a threshold that didn't stop anyone applying would be
another settable-but-unread flag, like the batch policy flags still are. The
refusal names the figure: *"CGPA 8.4 is below the required 9."*

One definition, used everywhere. `eligibleStudentWhere()` lives beside the
evaluator so the badge, the "Eligible" KPI, the tab filter and the forecast
denominator cannot drift — otherwise the page contradicts itself with "28
eligible" above a list showing 44 badges. 13 unit tests pin the two to each
other.

Verified live: policy off → 44 Eligible / 0 Not eligible. Policy on at CGPA
7.5 and zero backlogs → **28 / 16**, the KPI read **28**, the Eligible tab
returned exactly 28 rows with none leaking, and tooltips gave the cause
("CGPA 7.06 is below the required 7.5. 1 live backlog — none are allowed.").
Apply blocked at 403 with the reason; a staff block still beat a passing
policy; turning it off restored 44 / 0.

> **Left switched OFF.** Thresholds are a college's own policy, so shipping
> it enabled with numbers invented during testing would have been the wrong
> call. Settings → Eligibility, when you want it.

### 4bis.23 Forecast corrections — 2026-10-14

Four problems, three of them real defects rather than presentation.

**The units didn't match.** A per-*application* select rate was multiplied by
a count of *students*. A student with three live applications has a better
chance than any one of them does. Now the projection prefers a per-student
rate — of students whose season is fully over, what share were placed — which
multiplies a student count with no conversion and no assumptions. When too
few students have finished to measure that (this college: only 3), it falls
back to the application rate and converts it properly: a student with `n`
live applications contributes `1 - (1-p)^n`. That assumes independence
between applications, which isn't strictly true, so the page says so.

**The interview pass rate was displayed but never used.** It sat in the
banner beside the select rate, implying the two compounded. They don't, and
they shouldn't — the select rate already reflects the whole funnel,
interviews included, so multiplying them would double-count the same
filtering step. It is now labelled context and explicitly called out as not
compounded.

**Departments were computed from a rounded rate.** `getDepartmentForecast`
was handed `selectRatePct / 100`, so departments used 0.905 while the
college-wide figure used 0.90476 and the parts could disagree with the whole.
It now takes the raw rate and the basis. Verified: department +30, college
+30.

**A 90.5% select rate isn't a real-world number.** That one is data, not
code — 19 of 21 resolved applications ending in SELECTED is an artifact of
seeding. It can't be fixed in the engine, so the engine stops pretending:
below 30 outcomes the projection is flagged **indicative only**, with the
sample size stated in the warning.

Also corrected: the banner and the stat card both said "applications" while
counting distinct students. It now reports both — "32 students who still have
applications running (54 applications between them)".

6 unit tests cover the arithmetic against a stubbed client, including that a
9x swing in interview pass rate leaves the projection untouched, and that the
projection can never exceed the number of unplaced students.

### 4bis.24 ResumeUsage was keyed at the wrong grain — 2026-10-14

Surfaced while testing §4bis.20, and **made routine by it**.

`ResumeUsage` was `@@unique([resumeId, driveId])` — asserting a resume can
only ever be used once per drive. A drive has several positions, so that
isn't true. Applying to a second position with the same resume raised a
unique violation, and the apply route's catch reported it as **"You've
already applied to this position"** — untrue, and the application was
refused. Separately, `applicationId` was optional with no cascade, so
deleting an application left an orphan usage row that blocked re-applying to
that drive permanently.

It was always possible, but §4bis.20 made the resume mandatory, so every
application now writes a usage row and the collision went from occasional to
routine.

**Why it stayed hidden:** nothing in the app ever *reads* `ResumeUsage` — it
is written and never queried. And both `prisma/seed.ts` and
`scripts/expand-college-data.ts` wrapped their inserts in `.catch(() => {})`,
swallowing this exact error on every seeded run. Those catches are gone.

**The fix is the key, not a workaround.** The grain is the application, not
the drive: `@@unique([resumeId, applicationId])`. The application link is now
`onDelete: Cascade`, so a deleted application takes its usage rows with it
instead of leaving an orphan behind.

A first attempt upserted the row to dodge the collision. That worked, but
re-pointed the existing row at the newer application — quietly erasing which
application the first usage belonged to. It is a plain `create` again now
that the key is right.

The duplicate check also no longer depends on reading a driver error: it is
an explicit lookup before the insert, with the P2002 catch kept only as a
race backstop, scoped to the application's own constraint so no other
collision can be mislabelled again. (`e.meta.target` turned out not to be
populated by this client version, which is exactly why inferring a
user-facing message from it was the wrong approach.)

Verified on a real two-position drive: position A **200**, same resume to
position B **200** with *both* usage rows kept, genuine duplicate **409**.
Deleting an application dropped its usage row (0 orphans), and re-applying
afterwards returned **200** — previously blocked for good.

### 4bis.25 Editing an offer — 2026-10-14

The drive's Offers panel showed a name, a figure and **Issue to student**.
Nothing else. A typo in a package meant withdrawing the offer and creating a
new one.

The endpoint already existed: `PATCH /api/offers/[id]/manage` with
`action: "edit"`, gated on `offer.edit`, validated by `editOfferSchema`.
**Nothing in the app ever called it** — a complete, tested write path with no
caller, the same shape of gap as the batch policy flags.

So this is mostly wiring: a reusable `EditOfferDialog` covering every field
the validator accepts — offer type, total, fixed, variable, stipend, joining
bonus and joining date — dropped into the drive's Offers panel beside Issue.

Two details that aren't just wiring:

**Blank means "leave it alone", not zero.** `editOfferSchema` coerces with
`z.coerce.number()`, and `Number("")` is `0` — so posting every field would
silently rewrite an empty stipend to ₹0. The dialog omits empty boxes from
the payload entirely. Verified: editing an offer with no stipend left the
column NULL rather than writing 0.

**Draft only, on both sides.** The server already refused to edit anything
past DRAFT ("withdraw and recreate it otherwise"), on the reasoning that an
issued offer is one the student has already seen. The trigger only renders
for a draft, so the UI and the 409 agree instead of offering an action that
fails.

**Audit added.** Compensation is the most consequential number in the module
and was editable with no trace at all. `offer.edited` now records the full
before-shape alongside the change, because "the package changed" is only
answerable with what it changed *from*. `offer.withdrawn` got the same
treatment while in that handler — a pre-existing gap, not one introduced
here.

Verified: edit returned 200 and stored every field; a student calling it got
**403**; issuing then re-editing returned **409** with the reason; the audit
row carried both sides. The drive page renders Edit beside Issue for a draft
with `canEditOffer: true`.

> **Confirmed in a real browser — by the user, mid-build.** The audit trail
> shows an edit at 12:11:34 from the TPO account setting stipend ₹12,000 and
> a joining date through this dialog, 8 seconds after the API test, followed
> by issuing the offer. That is the click-path verification the Chrome
> extension couldn't give for §4bis.21 and §4bis.24.

> **Not added:** the same dialog isn't on the Offers list page
> (`components/offers/offer-manage-actions.tsx`), which still has only
> Withdraw. It's a one-line drop-in if wanted — the ask was the drive
> section.

---

### 4bis.26 Off-campus placements — 2026-10-14

Students who land a job or internship on their own had nowhere to be
recorded. "Placed" was derived purely from `Offer`, and `Offer.driveId` is
required — so a student who found their own employer stayed **Seeking**
forever and the college under-reported its own placement rate.

**A new model, not a nullable Offer.** Making `Offer.driveId` nullable would
have pushed null handling through ~20 reporting call sites, most of which
legitimately mean *"offers from this company via our drives"* and should not
count a placement the college had no part in. `OffCampusPlacement` is
separate, with `companyName` as free text rather than a `Company` relation —
the employer a student found themselves usually has no `CollegePartnership`,
and creating one as a side effect of recording a placement would corrupt the
company module's own numbers.

**Job vs internship is the point of the form.** The type picker swaps the
money fields rather than showing both: a job carries an annual CTC, an
internship a monthly stipend and a duration. Mixing them would be silently
destructive — a ₹35,000 stipend averaged against annual CTCs. Verified: an
internship stores `stipend` with `totalCompensation` NULL, and the dashboard
average package stayed ₹4.73L rather than collapsing.

**Verification before it counts.** Only a `VERIFIED` record moves placement
figures. Staff-entered ones are verified on creation — the person recording
it is the person who would otherwise verify it — and the `REPORTED` state
exists so a student self-report path can be added without a migration.

**One definition of placed.** `lib/students/placement.ts` now covers both
routes, so the roster badge, the placed/not-placed tabs, the KPI, the
profile, compare, the dashboard and analytics all pick it up from one place.

> **A bug this nearly introduced:** `placedStudentWhere` used to be a single
> key, so call sites did `Object.assign(where, placedStudentWhere)`. It now
> carries a top-level `OR`, which would have silently **overwritten the
> search `OR`** already on that object — the Placed tab combined with a name
> search would have returned the wrong students. Added `andStudentWhere()`
> and moved every call site onto it.

**Deliberately excluded from company, contact and drive reports.** Those
answer "how did our partnership with this company perform", and an
off-campus placement had no drive and no partnership. Including it there
would inflate a company's numbers with something it never ran.

**Registering the model for tenant scoping was required.** `db.offCampusPlacement`
came back `undefined` until `"OffCampusPlacement"` was added to
`TENANT_MODELS` in `lib/tenant/scoped-db.ts` — worth remembering for the
next model with a `collegeId`.

Verified live: recording a job flipped the student to **Placed** on the
roster, moved the placed tab from 4 to 5 students and the dashboard from
4 to 5, and removed them from not-placed; an internship took the count to 6
without touching the average package; editing internship→job cleared stipend
and duration; rejecting a record dropped the count back; a student calling
the endpoint got **403**; a blank company name got **400**. Deleting the test
rows returned the dashboard to its baseline of 4.

> **A policy question for you, not a bug:** a VERIFIED off-campus record
> counts as placed whatever its type, which mirrors how a campus `Offer`
> with `offerType: INTERNSHIP` already counts today. If your reporting
> treats internships separately from final placements, that is a one-line
> change in `placedStudentWhere` — but it is your definition to set, so I
> matched the existing behaviour rather than inventing a new one.

> **Not built:** students can't report their own off-campus placement for a
> TPO to verify. The `REPORTED` status and the verify/reject endpoint are
> both in place for it; only the student-facing form is missing.

---

### 4bis.27 Applications filters — seven were inert, and the header lied — 2026-10-14

Reported as "filter is not working properly". Three separate faults.

**Seven filters did nothing at all.** `handleSubmit` looped over a hardcoded
subset of filter keys that omitted `companyId`, `minCgpa`, `maxCgpa`,
`minTenth`, `minTwelfth`, `placement` and `excludePlaced`. Those controls
rendered, accepted input, and threw the value away — the page reads them
from the URL and the form never put them there. The panel kept three
different lists (one for the badge count, one for Clear all, one for
submitting) and they had drifted apart. There is now one `FILTER_KEYS` list
and the submit loop derives from it, so a new filter cannot be added and
left unreachable.

Verified against the database, every figure matching exactly: no filter 84,
`minCgpa=8` 50, `minCgpa=9.5` 8, `minTenth=90` 37, a company 16,
`excludePlaced=1` 70, `placement=placed` 14.

**The summary cards contradicted themselves.** Each card does
`{ ...where, status: "..." }` for its own bucket, overriding the status
constraint the active tab had already put on `where`. On the Shortlisted tab
the header read **"Total Applications 0"** directly above **"In Progress
2"**. The cards and the funnel are a *breakdown of the filtered population*,
so they now get the filters with the status constraint removed. Same
scenario now reads Total 4 / Shortlisted 0 / In Progress 2 — consistent, and
it actually tells you something.

**Nothing explained the zero.** The screenshot case — department + Civil
Engineering on the Shortlisted tab — was genuinely 0, because Civil has 4
applications and none are shortlisted. Correct, but indistinguishable from a
broken filter. The caption now names the tab and offers the way out:
*"0 applications shown in Shortlisted of 4 matching your filters. Show all
statuses"*.

**Multi-select, as asked.** Company, Drive, Status, Department and Course
are checkbox lists with **Select all** / **Clear**, instead of single-select
dropdowns. Values travel as one comma-joined query parameter and become a
Prisma `in` — a single selection produces a one-element `in`, which behaves
exactly like the old equality, so existing saved views and bookmarked URLs
keep working. Verified: Civil 4, Mechanical 1, both together 5.

`components/ui/multi-select-filter.tsx` is deliberately an inline scrollable
list, not a nested popover — the panel is already a popover, and stacking
two means the inner one steals the outer one's dismiss and the whole panel
closes on the first click. Select all acts on what is *visible*, so
searching and then selecting all does what it appears to.

> **Checked, not affected:** the Students filter panel submits all 18 of its
> keys. The Applications panel was the outlier. The drives, offers,
> companies, contacts, interviews and network panels were not audited.

---

### 4bis.28 Finding and bulk-marking off-campus students — 2026-10-14

§4bis.26 could *record* an off-campus placement but only one student at a
time, from inside that student's own Offers tab, and there was no way to
list who had one. A TPO working through "everyone who interned at Infosys"
had to open 30 profiles. Two gaps closed.

**Seeing them: a "Placed via" filter on the roster.** A separate axis from
Placement status, because that one answers *whether* and this answers *how*:
Off-campus (any) / Off-campus job / Off-campus internship / Campus drives
only. Rows placed off-campus now carry a second badge under **Placed**
naming the route, with the employer in its tooltip — so the roster answers
"who placed themselves" without opening anything.

Verified: with 3 internships and 1 job recorded, `offCampus=INTERNSHIP` → 3,
`offCampus=JOB` → 1, `any` → 3, `none` → 42 of 45.

**Marking them: a bulk action.** "Mark off-campus" joins the existing
Students bulk bar, so it reuses the checkboxes and select-all already there.
Pick Job or Internship, type the company, and it applies to everyone
selected — the money fields swap with the type for the same reason the
single dialog does.

Gated on `offer.create` on top of `student.bulk_update`, the same layering
as add-to-drive, because it moves the placement rate.

**Idempotent on purpose.** Students who already hold a verified record for
that same company *and* type are skipped, not duplicated — re-running the
action after adding one more student to the selection is a normal thing to
do. Verified: first run `successCount: 3, skipped: 0`; identical re-run
`successCount: 0, skipped: 3`.

> **A trap avoided:** the new `offCampus` key was added to the panel's
> `FILTER_KEYS`, its submit loop AND its Clear-all list. §4bis.27 was caused
> precisely by those three lists drifting apart.

> **Still not covered:** the Job Offers and Internship Offers pages read the
> `Offer` table only, so an off-campus internship does not appear under
> "Internship Offers". Those pages are built around the offer lifecycle
> (issue → accept → join) which an off-campus record has no equivalent of,
> so merging them is a design decision rather than a wiring job. The roster
> filter is the way to list them today.

---

### 4bis.29 Placement becomes a decision, and a TPO-set cap — 2026-10-14

Four changes, one theme: the college decides, not the data.

**Placed is now confirmed by a human.** It used to be derived — any accepted
offer made a student placed. That was wrong both ways: a student can hold an
off-campus internship and still be very much on the market, and §4bis.26
compounded it by making every verified off-campus record auto-place someone.
`Student.placementConfirmedAt` is now the single answer. Offers and
off-campus records are *evidence*, surfaced on the profile; nothing marks a
student placed on its own.

Backfilled on migration from existing accepted offers, so no reported figure
moved on deploy — 4 students confirmed, matching the 4 who held offers.

**Mark as placed, behind its own permission.** `student.mark_placed`, granted
to TPO, College Admin and Placement Coordinator. Deliberately not folded into
`student.edit`: confirming closes the student out of further drives and moves
the placement rate. The student is notified either way, because finding out
by hitting a wall is worse. Run
`npm run db:backfill-mark-placed-perm` on an existing college.

**The cap is entirely TPO-set — the mode as well as the numbers.** Settings →
Placement caps:

| Mode | Rule |
|---|---|
| Fixed minimum package | one college-wide bar, whatever they currently hold |
| Multiple of current | the bar scales with each placement |

Plus an optional **different bar when they crossed fields** — a technical
student who took a non-technical role, or the reverse — with branches ticked
as technical in the same tab and drives carrying their own flag. Off by
default, in which case one rule applies to everyone.

Hardcoding either mode would have made this useless to half of the colleges
that use it, which is why the mode is a setting and not a constant.

With the cap switched off, a confirmed placement blocks further applications
outright — the behaviour a placement cell expects by default.

Verified end to end: off-campus internship recorded → `placementConfirmedAt`
stayed **NULL**; TPO marked placed → set; student calling the endpoint →
**403**. Cap off → blocked outright. Floor at ₹10L with the drive at ₹8L →
*"only allows further applications at ₹10L or above, and this drive offers
₹8L"*. Drive raised to ₹12L → allowed. Placement withdrawn → a ₹5L drive
allowed again. 10 unit tests cover the modes, including the exact 6 LPA →
10 LPA example and the cross-field reversal.

**Responsive and PWA.** The reported symptom was the Applications filter
panel running off the screen. Two root causes, fixed across every filter
panel and tall dialog:

- `max-h-[75vh]` → `max-h-[70dvh]`. `vh` ignores the mobile browser's
  address bar, so the Apply button sat underneath it and was unreachable.
- A fixed `w-96` popover is wider than a 360px phone. Now
  `w-[calc(100vw-1rem)] sm:w-96`, with `collisionPadding` and a
  `max-w-[calc(100vw-1rem)]` on the positioner so it can never overflow.

Also: every dialog added today had an unprefixed `max-w-*`, which
tailwind-merge resolves *over* the base `DialogContent`'s
`max-w-[calc(100%-1rem)]` — so they rendered edge-to-edge with no gutter on
a phone. All scoped to `sm:` so the base survives on small screens.

> **Not verified in a browser.** The Chrome extension is not connected, so
> the responsive work was done by reading the classes and reasoning about
> the cascade, exactly as §4bis.19 was. The API behaviour above is all
> confirmed against the running app; the layout is not confirmed on a real
> device.

> **A consequence worth stating:** `placementStatus = "PLACED"` set by hand
> on a student record no longer makes them placed — only
> `placementConfirmedAt` does. That column now carries the student's own
> intent (seeking / not interested / opted out) and nothing else.

---

### 4bis.30 Cap corrected to an increment, and off-campus in the Offers pages — 2026-10-14

**The cap rule was wrong.** §4bis.29 shipped a fixed floor and a multiplier.
Neither is what a campus cap actually is: the bar is the student's **current
package plus a step**. Hold 6 LPA with a 4 LPA step and you may only chase
10 LPA and above.

`INCREMENT` is now a third mode and the default. The other two stay — the
TPO picks under Settings, since the brief was explicitly that nothing is
hardcoded, and a college that genuinely wants an absolute floor should still
be able to set one.

The difference matters: a fixed floor treats a student on 3 LPA and one on
12 LPA identically, while an increment moves the bar per student. The
Settings form now shows a worked example that updates as the figure is
typed, so a TPO can see which they are configuring before saving.

Verified live, student holding ₹6L with a ₹4L step: drive at ₹8L blocked,
₹9L blocked, ₹10L allowed, ₹15L allowed — with the message naming both
figures, *"already placed at ₹6L ... only allows further applications at
₹10L or above, and this drive offers ₹8L"*. 14 unit tests cover all three
modes plus the cross-field variant of each.

**Off-campus placements now appear in the Offers pages**, routed by type: an
off-campus job under Job Offers, an off-campus internship under Internship
Offers. They are a different model with no drive, so they are fetched
separately and merged into the rows rather than forced through the Offer
query.

| | |
|---|---|
| Badge | Each off-campus row is labelled, because a campus offer and a self-found one mean very different things |
| Filter | **Placed via** — any route / campus only / off-campus only |
| Selection | Off-campus rows are deliberately **unselectable**: the bulk bar PATCHes `/api/offers/*`, which these are not |
| Tabs | They appear only on All and Joined — the other tabs are Offer-lifecycle states (draft, issued, declined) an off-campus record has no equivalent of |
| Link | The student name points at their profile, not `/offers/[id]`, which doesn't exist for these |

**A joined milestone.** `OffCampusPlacement.joinedAt`, toggled from the
student's Offers tab, mirroring the campus JOINED state so one lifecycle
reads across both routes: recorded → verified → joined. Verified: marking
joined put the row in the Joined tab; undoing removed it.

Verified routing: `/offers` showed the off-campus job and not the
internship; `/offers?type=internship` the reverse; `?source=offcampus`
showed only off-campus rows; `?source=campus` none.

> **A bug this surfaced in my own work.** §4bis.29 made placement a
> confirmed decision in `lib/students/placement.ts`, but
> `lib/dashboard/get-stat-cards.ts` and `lib/analytics/stats.ts` were still
> deriving it from offers. A student confirmed placed without an accepted
> offer showed as **Placed** on the roster and was **missing from the
> dashboard** — 4 against the roster's 5. Both now count straight off
> `placementConfirmedAt`. Caught because the dashboard disagreed with the
> database during cleanup, not by design.

---

### 4bis.31 Off-campus visible everywhere it should be — 2026-10-14

**The Students filter rendered as bare chevrons.** Department, Course, Batch
and Placement status were `<SelectTrigger>` with no width. A trigger shrinks
to its content and an unset filter has no content, so they collapsed to the
arrow alone. Eight of them across two panels now carry `w-full`. Also caught
a `max-h-[min(85vh,42rem)]` the §4bis.29 sweep missed, because the regex
only matched a bare `max-h-[85vh]`.

**The off-campus badge was trapped inside the placed branch.** §4bis.29 made
an off-campus record stop implying placement, but the roster badge was still
nested under `placementStatus === "PLACED"` — so the students it was built
to surface were exactly the ones not showing it. It now renders
independently, and a row reads **"Eligible · Off-campus internship"**, which
is the combination a TPO most needs to spot.

**The route badge moved to the Status column** on the Offers pages, from
Type. That is where someone looks to answer "how is this student placed",
and it now sits with the placement state: `Accepted · Off-campus job ·
Marked placed`.

**Mark placed, from the list.** An off-campus row that hasn't been confirmed
shows a **Mark placed** button inline, so a TPO working down Job Offers acts
on the evidence they are already reading instead of opening each profile.
Once confirmed it becomes a **Marked placed** badge.

**Analytics splits placements by route.** A stacked bar plus a legend:
through a campus drive / both / off-campus / confirmed with nothing on file
yet. "Both" is its own bucket rather than double-counted or arbitrarily
assigned, and the fourth exists because a TPO can confirm a placement before
any paperwork lands — folding those into "campus" would have been a quiet
lie. The card states plainly that all of them count towards the one
placement rate.

Live reading during verification: campus 4 (66.7%), off-campus 1 (16.7%),
nothing-on-file 1 (16.7%), all 6 inside a 13.3% rate.

> **A formatting bug caught in testing:** an off-campus internship stores a
> *monthly stipend*, and the Offers table ran it through the annual-CTC
> formatter — ₹30,000/mo displayed as **"₹0.3L"**, which reads like a
> derisory annual package. Off-campus internships now render as
> `₹30,000/mo`.

Verified: `/offers` showed the off-campus job and not the internship;
`?type=internship` the reverse; both carried the badge and the action;
marking placed from the list flipped the row; the roster showed the badge on
an unplaced student.

---

### 4bis.32 A student with both an off-campus job and internship — 2026-10-14

The roster badge read the student's **most recent** off-campus record and
nothing else:

```
offCampus: s.offCampusPlacements[0] ? { type: ... } : null
```

So a student holding an off-campus internship *and* an off-campus job showed
whichever was created last, and silently hid the other. Create the
internship first and the job second, and their internship disappeared behind
a badge reading **"Off-campus job"** — which is what was reported.

Reproduced before fixing: Zara Kapoor given a Swiggy internship then a Zoho
job showed one badge, "Off-campus job".

The roster now derives **one badge per type held**, not per record — a
student with three internships gets one "Off-campus internship" badge
listing all three companies in its tooltip, and a student with both kinds
gets both badges. After the fix the same student reads
**"Eligible · Off-campus internship · Off-campus job"**.

Verified across every surface: roster filters returned
`INTERNSHIP` → 2, `JOB` → 1, `any` → 2 with the same student correctly in
both type filters; `/offers` showed only the job, `?type=internship` only
the two internships, each with the right badge and stipend formatting; the
profile listed both records separately.

> **Checked, not affected:** the Offers table and the profile's off-campus
> card render one row *per record*, so their badges were always per-record
> and correct. A repo-wide grep confirmed no other place takes
> `offCampusPlacements[0]`.

---

## 5. Known issues before production

### Blockers

1. **Files are stored in the database** as base64 (`dataUrl` columns,
   4 places). At 200,000 students one resume each is ~136 GB of text
   columns. **Move to object storage (S3/R2/Blob).**
2. **No backups exist.** Use managed Postgres with PITR, plus nightly
   `pg_dump` to object storage in a different account/region, plus a
   **monthly restore drill** — an untested backup is not a backup.
3. ~~**No email provider.** Password resets are manual.~~ **Resolved** —
   see §4bis.6. `lib/email/send.ts` ships with a `log` driver (captures to
   `.mail/`, sends nothing) and an `smtp` driver. **Still to do before
   production: set `EMAIL_DRIVER=smtp` and supply `SMTP_HOST` / `EMAIL_FROM`,
   then verify the sending domain (SPF/DKIM).** Until that is done, invites
   are captured locally and never actually delivered.
4. **Sessions cannot be revoked.** `lib/auth/session.ts` verifies the JWT and
   never checks the database, so deactivating a user does **not** sign them
   out — up to 30 days with "remember me".
5. **Rate limiting is in-process memory** (`lib/auth/rate-limit.ts`). Useless
   across multiple instances; resets on deploy. Needs Redis.

### Also

6. **Migration drift** — `20260917190500_add_college_branding` is applied to
   the database but **its folder is missing from the repo**.
   **Confirmed blocking**: `prisma migrate dev` refused to create a migration
   this session and offered to reset the database ("All data will be lost").
   Both new migrations had to be hand-written and applied with
   `prisma migrate deploy`, which skips the drift check.
   A fresh database is **not** affected — all migrations were applied to a
   scratch database cleanly, and the five orphan `colleges` columns
   (`appName`, `appShortName`, `backgroundColor`, `brandingVersion`,
   `themeColor`) appear in no migration, no `schema.prisma` and no code.
   **Fix: drop those five columns**, after which `migrate dev` works again.
7. **Migrations run on app boot.** With several instances starting at once
   they race. Move to a separate release step.
8. **Most list queries are unbounded** — only 4 of 22 student queries use
   `take`.
8b. **Batch policy flags are settable but never enforced.** `Batch` carries
   `registrationEnabled`, `loginAllowed`, `allowDiploma`,
   `requireApprovalForAcademicsUpdate` and `autoApprovalOnRegistration`.
   They appear only in `lib/validators/settings.ts` and the
   `batch-settings-table` toggles — **no route reads them**:
   `api/auth/login` does not check `loginAllowed`, `api/applications` does
   not check `registrationEnabled`, and
   `requireApprovalForAcademicsUpdate` isn't even in the settings UI.
   Toggling them in Settings therefore changes nothing. With multiple
   cohorts now reachable (§4bis.12) this matters: there is no way to freeze
   registration for a graduated batch or block its logins, so an alumnus of a
   closed batch can still sign in and apply. Worth wiring before a second
   cohort goes live.
9. **Plan limits are not enforced** (see §3).
10. **21 pre-existing lint errors**, mostly `react-hooks/set-state-in-effect`.
    Unchanged by this session's work.
11. **No general unread system.** _(still open as of 2026-10-02)_ `SidebarNav` supports a `badge` on any nav
    item, but only four are populated (Opportunities, External Jobs, Students
    — and of those only Opportunities is genuinely unread; the others are
    work-queue counts). **`messagesCount` is declared
    as a prop and never passed by the layout**, so the Messages badge can
    never appear despite `ConversationParticipant.lastReadAt` already holding
    the data. Nothing tells a user that something new arrived in
    Applications, Offers, Interviews, Events or Forums.
    *Proposed:* one `SectionSeen { userId, section, lastSeenAt }` table plus a
    `lib/nav/unread.ts` computing every badge in one `Promise.all`, replacing
    the one-off `Student.opportunitiesSeenAt`. Each page marks its section
    seen on open, so a badge clears per user and not for everyone. Cost to
    weigh: ~6-8 count queries on every page load, since the sidebar renders
    on all of them.

---

## 6. Environment variables

```bash
# Required
DATABASE_URL=
JWT_SECRET=
NEXT_PUBLIC_APP_URL=

# Subdomain routing (to be added with middleware)
ROOT_DOMAIN=yourapp.com
PLATFORM_HOST=admin.yourapp.com

# Branding
NEXT_PUBLIC_PWA_NAME=
NEXT_PUBLIC_PWA_SHORT_NAME=
NEXT_PUBLIC_PWA_DESCRIPTION=
NEXT_PUBLIC_DEVELOPER_NAME=
NEXT_PUBLIC_PWA_LOGO_PATH=

# Push notifications — currently unset, so push is dormant
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:you@yourdomain.com
VAPID_KEY_ID=

# Cron endpoints — unset means they return 501
CRON_SECRET=

# Starter password for TPO-created students. Unset = their enrollment number,
# which is per-student; a fixed value here is shared across every account.
# Either way User.mustChangePassword forces a replacement at first login.
DEFAULT_STUDENT_PASSWORD=

# Email — `log` captures to .mail/ and sends nothing; `smtp` sends for real
EMAIL_DRIVER=log
EMAIL_FROM="Placement ERP <no-reply@yourcollege.edu>"
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=

# Optional
LOG_LEVEL=info
ASSESSMENTS_APP_URL=
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
```

---

## 7. Operational commands

```bash
# Repair resumes seeded without a File (safe to re-run; --dry-run to preview)
npm run db:backfill-resumes

# Create or reset the first superuser (also the lockout recovery path)
npm run platform:create-admin -- you@yourdomain.com "Your Name" YourPassword

# Strip platform-tier permissions from college roles (already applied once)
npm run platform:revoke-perms -- --dry-run
npm run platform:revoke-perms

# Health probe
curl https://admin.yourapp.com/api/health
```
