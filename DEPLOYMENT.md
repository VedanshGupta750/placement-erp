# Deployment — Placement ERP

## Where it runs

Hosted on **Railway**. The project needs these services:

- `placement-erp` — the Next.js app itself
- `placement-erp-push` — the Web Push delivery worker, using the same repository and database
- `Postgres` — the app's database (no public TCP proxy configured; only reachable from inside Railway's network, see "Reaching the production database" below)

Production URL: `https://placement-erp-production.up.railway.app`

The sibling app, `placement-erp-assessments`, is a **separate** Railway project/service with its own Postgres — it is not deployed by anything in this repo.

## Deploying

```bash
railway up --service placement-erp --detach
```

Run from the repo root, with the Railway CLI already linked to this project (`railway link` if it isn't). `--detach` returns immediately instead of streaming logs; poll status separately:

```bash
railway status --json | python3 -c "
import json,sys
d = json.load(sys.stdin)
for env in d['environments']['edges']:
    for si in env['node']['serviceInstances']['edges']:
        node = si['node']
        if node['serviceName'] == 'placement-erp':
            print(node['latestDeployment']['status'])
"
```

Statuses move `QUEUED` → `INITIALIZING`/`BUILDING` → `DEPLOYING` → `SUCCESS` (or `FAILED`/`CRASHED`). A `FAILED` status with `"Repository snapshot operation timed out..."` in `meta.configErrors` is a transient Railway infra issue, not a code problem — just retry `railway up` again. The previous deployment keeps serving traffic the whole time a new one is building (zero-downtime), so a failed/retried deploy is not an outage.

### What happens automatically on deploy

The `start` script is `prisma migrate deploy && next start` — **every deploy runs any pending Prisma migrations against production before the app starts serving traffic.** There is no separate manual migration step. This means: never hand-edit a migration file that's already been applied to production, and always generate migrations locally (`npx prisma migrate dev --name ...`) so the migration file that ships is the one that was actually tested against a real schema change.

### Local-first workflow

This codebase's convention: build and verify against the local dev database first (`npm run dev`, local Postgres via `DATABASE_URL` in `.env`), run `npx tsc --noEmit` and `npx eslint` clean, then `npm run build` locally to catch build-time errors before ever pushing to Railway. Only deploy once that's clean. Batch multiple small local fixes into one deploy where practical — Railway's build queue gets congested if you deploy after every single small change.

## Reaching the production database directly

The production Postgres has **no public TCP proxy** — `railway connect` / a direct `psql` connection from a laptop won't work. The way to run one-off scripts (data fixes, backfills, ad-hoc queries) against production is to execute them *inside* the already-running app container, which **is** on Railway's internal network:

```bash
railway ssh --service placement-erp -- "<command>"
```

Important gotcha: **do not** wrap the command in an extra `bash -c "..."` — `railway ssh` already runs whatever you pass through a remote shell, and double-wrapping causes pipes/redirects in your command to apply to the wrong thing (a `bash -c "echo X | ..."` will silently truncate `X` to nothing). Just pass the full command string directly after `--`.

Practical recipe for running a one-off TypeScript script against production data:

```bash
# 1. Write the script locally, importing the app's own generated Prisma client
#    (matches lib/db.ts's construction exactly):
#      import { PrismaClient } from "/app/lib/generated/prisma/client.ts";
#      import { PrismaPg } from "@prisma/adapter-pg";
#      const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
#      const prisma = new PrismaClient({ adapter });
#      ... your logic, using prisma.<model>.findMany/create/update/delete ...
#      await prisma.$disconnect();

# 2. Base64-encode it and write it into the running container, then execute
#    it with the container's own bundled tsx binary (no local Node/DB access
#    needed at all — everything runs inside the container):
B64=$(base64 -i my-script.mts | tr -d '\n')
railway ssh --service placement-erp -- "echo $B64 | base64 -d > /app/tmp_script.mts && cd /app && ./node_modules/.bin/tsx tmp_script.mts && rm tmp_script.mts"
```

Running from `/app` matters — that's where `node_modules` actually lives inside the container, so relative imports resolve. `DATABASE_URL` is already set as an environment variable inside the container, so the script doesn't need to load `.env` itself.

This is the same technique used to seed real data into production tables and to run bulk data-migration scripts (e.g. bulk-approving pending `ExternalJobReview` rows after a workflow change) without needing a public database connection.

## Environment variables

See `.env.example` for the full list of variables the app expects. At minimum: `DATABASE_URL`, `JWT_SECRET` (must match the value used by `placement-erp-assessments` for its SSO handoff to work), and an Anthropic API key for the AI features (JD/resume parsing, Copilot, insight generation).

### PWA identity and push notifications

The installed application's identity is controlled by the code owner through source assets and deployment variables. College administrators cannot edit it. Set the four public PWA values from `.env.example` on the web service before building. Replace the PNG files in `public/pwa/` through `scripts/generate-pwa-icons.py` when changing the official app artwork; do not connect these values to college settings.

Generate a VAPID key pair once with `npx web-push generate-vapid-keys`, then set:

```text
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<public key>
VAPID_PRIVATE_KEY=<private key>
VAPID_SUBJECT=mailto:<monitored address>
VAPID_KEY_ID=v1
CRON_SECRET=<long random secret>
```

`NEXT_PUBLIC_VAPID_PUBLIC_KEY` must also be available when the web app is built. Keep the private key and cron secret server-only. A VAPID key change invalidates existing browser subscriptions, so change `VAPID_KEY_ID` and ask users to enable notifications again after a planned rotation.

Create `placement-erp-push` from the same repository, give it the same database and VAPID variables, and set its start command to:

```bash
npm run worker:push
```

Run a single worker initially. It safely claims queued rows, recovers stale claims, retries temporary failures with bounded backoff, and disables subscriptions rejected as gone by a push provider. The web service continues to serve the canonical in-app notification inbox if push is disabled or unavailable.

The app also exposes `GET /api/cron/push-delivery` for a scheduler fallback. Calls must include `Authorization: Bearer <CRON_SECRET>`. Do not run the continuous worker and a high-frequency scheduler unless that extra capacity is intentional.

## Rolling back

Railway keeps prior deployments. From the Railway dashboard, a previous successful deployment can be redeployed directly if a bad release needs to be reverted quickly — this bypasses `git`/CLI entirely and just re-points traffic at the last-known-good build. Note this does **not** roll back any database migration that already ran — a migration that shipped with the bad release stays applied unless someone writes and runs a down-migration by hand.
