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
