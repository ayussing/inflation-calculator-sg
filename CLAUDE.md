# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

A Next.js app has been scaffolded in `web/` (App Router, TypeScript, Tailwind) — this is the single
application for both frontend and API; there is no separate backend service. Application logic
(calculation engine, ingestion, data model) still needs to be built out. `docs/personal-inflation-calculator-brief.md`
(detailed design reference, committed to the repo) has the full design.

Build/lint/test commands run from `web/`: `npm run dev`, `npm run build`, `npm run lint`.

When extending the project, follow the architecture and decisions below rather than inventing a
different structure.

## What this project is

A data.gov.sg take-home assignment: a personal inflation calculator for Singapore. A user enters
monthly spending by CPI category; the app computes a weighted personal inflation rate from official
SingStat CPI data and compares it to the headline rate, showing which categories drove the
difference.

Core formula:
```
personal_inflation = Σ ( w_i × r_i )
  w_i = user's share of total spending in category i (normalised to sum to 1)
  r_i = % change in category i's CPI over the selected period
```

## Architecture (as planned)

```
data.gov.sg API --(scheduled monthly pull)--> Postgres (long-format CPI store, hosted on Aiven)
                                                    ^
Next.js app (web/): React frontend + Route Handlers (/app/api/*) as the API/calculation engine
```

Frontend and backend are **one Next.js app**, not separate services — UI code and API route
handlers live side by side in `web/app`. The route handlers are the calculation engine's API
surface; there is no separate API process to deploy or proxy to.

Key decisions to preserve when implementing:

1. **Calculation logic lives entirely server-side**, in `lib/` (imported by Route Handlers, never
   by client components) — one source of truth, testable in isolation, never duplicated into client
   code. The API is stateless.
2. **Ingest and cache CPI data on a schedule; never proxy data.gov.sg per request.** data.gov.sg
   rate-limits aggressively, and this keeps the app responsive and resilient to upstream outages.
3. **User spending data is never persisted server-side.** Baskets are shareable via URL-encoding,
   not database storage — this is a stated privacy/design differentiator, not an oversight.
4. **CPI data is stored long-format**, not as the wide per-period CSV shape SingStat exports it in.
   Wide-to-long normalization happens once, at ingestion time.
5. **Ingestion must be idempotent** — upsert keyed on `(series_id, period_date)` so reruns are safe.

### Code organization

```
web/
  app/
    api/                       # Route Handlers only — thin glue: parse request, call lib/, shape response
    (calculator)/              # route group: main UI, omitted from the URL
      page.tsx
      _components/             # page-specific UI, colocated and non-routable
  components/                  # UI components shared across routes
  lib/
    db/                        # Postgres client (Aiven)
    cpi/                       # CPI series/observation data access + types
    inflation/                 # calculation engine (pure, no I/O) + Zod request/response schemas
    ingestion/                 # data.gov.sg pull + idempotent upsert
```

- `app/` is for routing only — pages, layouts, and Route Handlers. Everything else (the calculation
  engine, DB access, ingestion) lives in `lib/`, organized **by domain, not by type**, so the
  calculation engine stays a pure, dependency-free module that's trivial to unit test.
- **Zod schemas are the single source of truth for request/response shapes.** Define them in
  `lib/<domain>/schema.ts`, validate the request body against them in the Route Handler, and derive
  types for both server and client with `z.infer<...>` — never hand-duplicate types between a Route
  Handler and the frontend that calls it.
- Route groups (e.g. `(calculator)`) organize `app/` by feature without affecting the URL. UI that's
  specific to one page belongs in that page's `_components/` folder; only genuinely shared UI goes
  in the top-level `components/`.

### Planned data model

```
cpi_series (id, code, name, level, parent_id, base_year)
cpi_observation (series_id, period_date, index_value)   -- unique (series_id, period_date)
basket_preset (id, name, income_group, source_year)
basket_preset_weight (preset_id, series_id, weight_per_10000)
ingestion_run (id, started_at, finished_at, status, rows_upserted, error)
```

### Planned API surface

Implemented as Next.js Route Handlers under `web/app/api/`:

| Method | Path | Route Handler file |
|---|---|---|
| `GET` | `/api/categories` | `web/app/api/categories/route.ts` |
| `GET` | `/api/cpi?categories=&from=&to=` | `web/app/api/cpi/route.ts` |
| `GET` | `/api/presets` | `web/app/api/presets/route.ts` |
| `POST` | `/api/inflation/personal` | `web/app/api/inflation/personal/route.ts` |
| `GET` | `/api/insights` | `web/app/api/insights/route.ts` |
| `GET` | `/api/health` | `web/app/api/health/route.ts` (already scaffolded) |

## Stack

- Frontend + backend: **Next.js** (App Router, TypeScript) in `web/` — one app. The frontend is
  React pages/components; the API/calculation engine is Next.js Route Handlers in the same app,
  not a separate service.
- Database: PostgreSQL, **hosted on Aiven** (managed, already provisioned) — the app connects with
  a connection string/credentials from environment variables (e.g. `DATABASE_URL`). No self-hosted
  or containerized Postgres to run or deploy. Client library: **`pg`** (node-postgres), a singleton
  `Pool` in `lib/db/client.ts` reused across `next dev` hot reloads. Aiven requires SSL; the pool
  connects with `ssl: { rejectUnauthorized: false }` rather than pinning Aiven's CA cert.
- Local dev: run the Next.js app directly (`npm run dev` in `web/`), pointed at Aiven Postgres via
  env vars (`.env.local`, gitignored). No Docker Compose is needed for Postgres; only introduce
  Docker Compose if a standalone ingestion worker process ends up needing one.
- Ingestion: a scheduled job (e.g. a cron-triggered Route Handler, or a separate script run on a
  schedule) that pulls from data.gov.sg and upserts into the Aiven Postgres instance.
- Deployment: the frontend and API deploy together as a single Next.js service (exact target —
  e.g. a container platform or serverless host — still open); the database is already deployed on
  Aiven, so no Terraform/CDK is needed to provision RDS.

## Known modeling caveats to carry into any implementation

- This is a Laspeyres-style fixed-basket approximation; it assumes constant spending patterns over
  the period and ignores substitution effects.
- Category-level CPI indices are national averages inside each category.
- SingStat quality adjustments inside each index are inherited, not recomputed.
- Verify the current CPI base year and exact `d_xxxxx` dataset IDs on data.gov.sg before wiring up
  ingestion — these details go stale and are called out as open items in the design brief.

## Testing strategy (as planned)

The standout validation test: feed SingStat's official basket weights into the calculation engine
and assert the output matches the published official all-items CPI change for the same period,
within a small tolerance — this proves correctness against real published figures. Beyond that:
unit tests for weight normalization and contribution math, property-based tests (e.g. 100% weight
in one category ⇒ result equals that category's rate; scaling spend leaves the result unchanged),
integration tests for ingestion against a real Postgres (Testcontainers) with fixture CSVs
containing `na` values and footnote rows, and Playwright end-to-end tests for the preset/slider
flow and shareable-link round-trip.
