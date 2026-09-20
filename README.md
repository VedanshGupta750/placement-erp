# Placement ERP

A multi-tenant campus placement management SaaS — built as a from-scratch, expanded reimplementation of the reference product "POD", following the accompanying **Placement OS Master Product Blueprint** and **Technical Freeze Pack** specs (schema, RBAC matrix, state machines, screen inventory).

## Stack

Next.js 16 (App Router, Turbopack) · Prisma 7 (`@prisma/adapter-pg`) · PostgreSQL · Tailwind v4 + shadcn (`@base-ui/react`) · Zod · Recharts · Papaparse

Conventions mirror `~/school-erp`: tenant-scoped Prisma client extension (`getTenantDb`), JWT session cookies (`jose`), Role/Permission RBAC resolved fresh per request, `collegeId` passed explicitly on every tenant-model `create` call even though the extension would inject it (TypeScript requires it statically).

## Four portals, one codebase

| Portal | Entry | Who |
|---|---|---|
| Placement Console (TPO) | `/sign-in` → `/dashboard` | TPO, Coordinators, Faculty, Management |
| Student Portal | `/sign-in` → `/dashboard` (branches by `userType`) | Students |
| Recruiter Portal | `/employer/sign-in` → `/employer/dashboard` | Company recruiters (separate `CompanyUser` auth, own JWT cookie) |
| College Admin Console | `/people`, `/roles`, `/courses`, `/settings` | Users with `isAdmin` on their department membership |

## Local setup

```bash
npm install
createdb placement_erp_dev   # or set DATABASE_URL to an existing one
cp .env.example .env         # fill in DATABASE_URL + JWT_SECRET
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Seed creates one demo college (Shri Ramdeobaba College of Engineering and Management, batch 2026) with 40 students, 9 companies, 7 drives across the full lifecycle, applications, offers, selection rounds, a forum post and a notification.

**Demo logins** (all `Password123!`):
- TPO: `tpo@demo.placement-erp.local`
- Student: `student@demo.placement-erp.local`
- Recruiter: `recruiter@demo.placement-erp.local`

## What's built

**Core placement lifecycle** — College → Campus → Department → Batch → Course → Student; Company → Drive → DrivePosition → Application → SelectionRound/RoundCandidate → Offer → JoiningRecord, with full state machines per the freeze pack (`DriveStatus`, `ApplicationStatus`, `OfferStatus`) and `ApplicationStatusHistory` as an append-only audit trail.

**Eligibility engine** (`lib/eligibility.ts`, `lib/eligibility-runner.ts`) — an AND/OR/NOT condition tree evaluator with a simplified authoring form (min CGPA / max backlogs) on top; publishing a rule freezes an `EligibilitySnapshot` + per-student `EligibilityResult` with a plain-English explanation, plus `EligibilityOverride` for manual TPO exceptions with mandatory reason + audit.

**RBAC** — 8 system roles (TPO, College Admin, Placement Coordinator, Department Coordinator, Faculty, Management, Student, Auditor) × ~70 `resource.action` permissions, matching the freeze pack's matrix. TPO always has every permission; other roles are editable per-college at `/roles`.

**Denormalised drive funnel counters** (`lib/drives/counters.ts`) — recomputed transactionally after every write that moves the funnel, rather than live-aggregated on every dashboard render.

**Notifications** (`lib/notify.ts`, `lib/push/dispatch.ts`) — real in-app notifications fire on drive publish (to every eligible student), application status changes, and offer issuance. Signed-in users can enable Web Push for the current device. Push subscriptions remain bound to the authenticated `userId` and `collegeId`, while a durable delivery row provides retry and delivery history.

**Progressive Web App** — the application ships with a developer-controlled manifest, install icons, offline fallback, service worker, Android-style mobile navigation, an install prompt in normal browser mode, and a standalone experience after installation. College profile names and logos still appear inside the portal, but they cannot change the installed app name, icon, developer attribution, or theme. Those values come only from source code or deployment environment variables.

PWA identity can be set by the code owner in `.env`:

```bash
NEXT_PUBLIC_PWA_NAME="Placement ERP"
NEXT_PUBLIC_PWA_SHORT_NAME="Placement ERP"
NEXT_PUBLIC_PWA_DESCRIPTION="Campus placements, applications, and updates in one app."
NEXT_PUBLIC_DEVELOPER_NAME="Your developer name"
NEXT_PUBLIC_PWA_LOGO_PATH="/pwa/your-square-logo.png"
```

To enable system push notifications, generate a VAPID key pair, add the values described in `.env.example`, and run one push worker alongside the web service. Browser notification permission is requested only after a signed-in user turns on notifications from the user menu.

**Bulk import** — CSV student import at `/students/import` (Papaparse client-side parse → row-level server validation → `Import`/`ImportError` tracking, partial-failure tolerant).

**Recruiter portal** — the gap the reference product never exposed: `CompanyUser` accounts (separate JWT session type, `lib/auth/company-session.ts`) connected to colleges via `CollegePartnership`, scoped candidate review (shortlist/reject) that can never enumerate the full student database.

## What's deliberately not built

Per the blueprint's own P0→Enterprise roadmap and "do not build first" guidance:
- Real SSO/MFA, payment gateway, webhook delivery engine, API keys infrastructure — modeled in spirit where relevant (e.g. `mfaEnabled` boolean) but not wired to a live provider.
- Separate multi-app monorepo (`super-admin-web`/`tpo-web`/`recruiter-web`/`student-web`) — kept as one Next.js app with route groups; a valid simplification at this scale.
- Assessment service, AI resume/JD intelligence, TPO copilot, broadcasts/message templates, document vault UI, saved views, PlacementSeason as distinct from Batch, Specialization as a separate table from Course — explicitly V2/Enterprise/"validate before building" scope.
- Community feed (Expert Sessions/Competitions posts) has full schema + seed data but no browsing UI yet — explicitly P2 in the blueprint.

## Commands

```bash
npm run dev          # start dev server
npm run dev:mobile   # expose the dev server to phones on the same Wi-Fi
npm run build         # production build (also runs full type-check)
npm run worker:push   # process queued Web Push deliveries
npx tsc --noEmit       # type-check only
npm run db:seed        # reset demo data (safe to rerun against an empty DB)
npx prisma studio       # inspect the database
```

## Test on a real phone before deployment

Connect the phone and development computer to the same private Wi-Fi network, then run:

```powershell
npm run dev:mobile
ipconfig
```

Find the computer's active `IPv4 Address`, for example `192.168.1.42`, and open `http://192.168.1.42:3002/sign-in` on the phone. Port 3002 keeps this PWA separate from School ERP on port 3000 and the optional Assessments service on port 3001. If Windows Firewall asks whether Node.js may communicate on a private network, allow private-network access. Keep the terminal running while testing.

The LAN address is suitable for responsive layout and sign-in testing. Service workers, Web Push, and the browser's native PWA installation require an HTTPS origin. For those tests, run `npm run dev:mobile`, expose port 3002 through an HTTPS tunnel such as Cloudflare Tunnel or ngrok, and open the generated `https://...` URL on the phone. Use Android Chrome for Android installation testing and iOS Safari for Add to Home Screen testing. Never commit tunnel credentials or VAPID private keys.
