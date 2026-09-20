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

## 5. Known issues before production

### Blockers

1. **Files are stored in the database** as base64 (`dataUrl` columns,
   4 places). At 200,000 students one resume each is ~136 GB of text
   columns. **Move to object storage (S3/R2/Blob).**
2. **No backups exist.** Use managed Postgres with PITR, plus nightly
   `pg_dump` to object storage in a different account/region, plus a
   **monthly restore drill** — an untested backup is not a backup.
3. **No email provider.** Password resets are manual. Impossible at scale.
4. **Sessions cannot be revoked.** `lib/auth/session.ts` verifies the JWT and
   never checks the database, so deactivating a user does **not** sign them
   out — up to 30 days with "remember me".
5. **Rate limiting is in-process memory** (`lib/auth/rate-limit.ts`). Useless
   across multiple instances; resets on deploy. Needs Redis.

### Also

6. **Migration drift** — `20260917190500_add_college_branding` is applied to
   the database but **its folder is missing from the repo**. `prisma migrate
   dev` therefore wants to reset the database. `npm start` runs
   `prisma migrate deploy` on every boot, so fix this before deploying.
7. **Migrations run on app boot.** With several instances starting at once
   they race. Move to a separate release step.
8. **Most list queries are unbounded** — only 4 of 22 student queries use
   `take`.
9. **Plan limits are not enforced** (see §3).
10. **21 pre-existing lint errors**, mostly `react-hooks/set-state-in-effect`.
    Unchanged by this session's work.

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

# Optional
LOG_LEVEL=info
ASSESSMENTS_APP_URL=
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
```

---

## 7. Operational commands

```bash
# Create or reset the first superuser (also the lockout recovery path)
npm run platform:create-admin -- you@yourdomain.com "Your Name" YourPassword

# Strip platform-tier permissions from college roles (already applied once)
npm run platform:revoke-perms -- --dry-run
npm run platform:revoke-perms

# Health probe
curl https://admin.yourapp.com/api/health
```
