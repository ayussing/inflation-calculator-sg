# Technical documentation

This documents the system **as built**. For the original design rationale and the assignment
brief this project started from, see
[personal-inflation-calculator-brief.md](personal-inflation-calculator-brief.md) — some details
there (RDS, S3/CloudFront, a split frontend/API) describe the originally considered architecture
rather than what was actually implemented; divergences are called out below where relevant.

## 1. System overview

![Architecture diagram](arch.svg)

*[Open in Excalidraw](https://excalidraw.com/#json=1EnL065TuVDMDe7-6HRWz,_XOrv4FVLJQAmrO-i--sfA) to view/edit live.*

Frontend and backend are one Next.js app (`web/`) — there is no separate API service. Two request
flows matter:

- **Calculation (read path)**: browser → `POST /api/inflation/personal` → `lib/inflation` (pure
  calculation, no I/O) reading pre-ingested CPI observations from Postgres via `lib/cpi` → JSON
  response. Nothing here calls data.gov.sg directly; it only ever reads what ingestion already
  stored.
- **Ingestion (write path)**: data.gov.sg CSV → `lib/ingestion` (download, parse, idempotent
  upsert) → Postgres. Triggered three ways: a bearer-token-protected `GET /api/ingest` route, a
  local `npm run ingest:cpi` script, and — in production — an EventBridge cron rule that runs a
  one-off Fargate task on the same schedule.

User spending input is never persisted server-side; the calculator UI encodes the basket
(categories + amounts + date range) into the page's URL so it round-trips through a shared link
without a database record.

## 2. Repository structure

```
web/
  app/
    (calculator)/            # route group (no URL segment) — the main calculator page
      page.tsx               # server component: fetches division-level categories, renders the app
      _components/           # page-specific UI (forms, charts, results panel) — not routable
      _lib/                  # page-specific logic: URL basket codec, React Query wiring, preset application
    api/                     # Route Handlers — thin glue: parse request, call lib/, shape response
      categories/route.ts    # GET  /api/categories
      cpi/route.ts           # GET  /api/cpi
      presets/route.ts       # GET  /api/presets
      inflation/personal/route.ts  # POST /api/inflation/personal
      insights/route.ts      # GET  /api/insights
      health/route.ts        # GET  /api/health
      ingest/route.ts        # GET  /api/ingest
      openapi.json/route.ts  # GET  /api/openapi.json
    api-docs/page.tsx        # Swagger UI, client-rendered against /api/openapi.json
  lib/                       # everything else, organized by domain (not by type)
  components/                # UI shared across routes (Card, DataTable, ThemeToggle, ...)
  migrations/                # node-pg-migrate SQL migrations (see §3)
  scripts/                   # CLI entry points: migrate.ts, ingest-cpi.ts, check-db.ts
infra/
  bin/infra.ts               # CDK app entry — instantiates the three stacks
  lib/network-stack.ts       # VPC
  lib/app-stack.ts           # ECS cluster, Fargate service + ALB, secrets, alarms
  lib/ingestion-stack.ts     # scheduled ingestion Fargate task + EventBridge rules
```

`web/lib/` by domain:

| Module | Responsibility |
|---|---|
| `lib/db` | `pg.Pool` singleton (`client.ts`, cached on `globalThis` to survive `next dev` HMR) and connection-string handling for Aiven's SSL requirements (`connectionConfig.ts`) |
| `lib/cpi` | CPI series/observation types, Zod schemas, and all read access (`repository.ts`) |
| `lib/inflation` | The calculation engine — pure functions, no I/O (`calculate.ts`, `period.ts`) plus the request/response Zod schemas for `/api/inflation/personal` |
| `lib/ingestion` | data.gov.sg client (`datagovsg.ts`), CSV parser (`parseCpiCsv.ts`), the orchestrator (`runIngestion.ts`), and the `ingestion_run` repository |
| `lib/insights` | Precomputed stats (e.g. category volatility) served by `/api/insights` |
| `lib/presets` | Official basket presets (income group → category weights) served by `/api/presets` |
| `lib/http` | Shared `ApiError` + `toErrorResponse()`, used by every Route Handler for a consistent error envelope |
| `lib/openapi` | Builds the OpenAPI document from the same Zod schemas that validate requests at runtime |

Route groups (`(calculator)`) organize `app/` by feature without affecting the URL; page-specific
UI and logic live in that page's `_components`/`_lib`, and only genuinely shared code lives in the
top-level `components/`. Zod schemas in `lib/<domain>/schema.ts` are the single source of truth
for request/response shapes — types are derived with `z.infer<...>` rather than hand-duplicated
between a Route Handler and its caller.

## 3. Data model

Five tables, defined across `web/migrations/*.sql`:

**`cpi_series`** — one row per CPI category (any level of the hierarchy, including the all-items
headline series):
```sql
id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY
code        text NOT NULL UNIQUE
name        text NOT NULL
level       smallint NOT NULL CHECK (level >= 0)
parent_id   integer REFERENCES cpi_series (id) ON DELETE RESTRICT
base_year   smallint NOT NULL
```

**`cpi_observation`** — long-format index values, one row per (series, month):
```sql
series_id    integer NOT NULL REFERENCES cpi_series (id) ON DELETE CASCADE
period_date  date NOT NULL          -- always the 1st of the month
index_value  numeric(10,3) NOT NULL
PRIMARY KEY (series_id, period_date)
```
Ingestion upserts keyed on this same `(series_id, period_date)` pair, which is what makes reruns
safe.

**`ingestion_run`** — an audit log of every ingestion attempt:
```sql
id             integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY
started_at     timestamptz NOT NULL DEFAULT now()
finished_at    timestamptz
status         text NOT NULL DEFAULT 'running' CHECK (status IN ('running','success','failed'))
rows_upserted  integer NOT NULL DEFAULT 0
error          text
```

**`basket_preset`** / **`basket_preset_weight`** — official spending baskets by income group,
used to prefill the calculator:
```sql
basket_preset (id, name UNIQUE, income_group, source_year)
basket_preset_weight (preset_id → basket_preset, series_id → cpi_series,
                       weight_per_10000 CHECK 0..10000, PRIMARY KEY (preset_id, series_id))
```

## 4. Calculation engine (`lib/inflation`)

Laspeyres-style fixed-basket calculation, entirely pure (no database or network calls — every
input arrives as a parameter), which is what makes it directly unit-testable:

- `normalizeWeights` — scales user-entered category spend to weights summing to 1.
- `calculateCategoryPercentChange` — `(end - start) / start` for a single category's CPI.
- `calculatePersonalInflation` — combines the two into `Σ(w_i × r_i)`, returning the personal
  index at the start/end of the period and per-category contributions that sum **exactly** to the
  total (not just approximately, thanks to `toDisplayPercentages`'s largest-remainder/Hare-Niemeyer
  apportionment when converting to display percentages).
- `convertPurchasingPower` — what a basket that cost $X at the start period would cost at the end.
- `period.ts`'s `resolvePeriod` — snaps a requested `{from, to}` range to the nearest periods
  Postgres actually has data for, returning warnings when it had to snap, and throwing
  `InvalidPeriodRangeError` / `NoAvailablePeriodsForRangeError` for genuinely bad requests.

The standout test, `lib/inflation/__fixtures__/singstat-2024-divisions.json` +
`calculate.validation.test.ts`, feeds SingStat's own published division-level basket weights
through this engine and asserts the result reproduces the published official All-Items CPI change
within 0.05 index points — i.e., it validates against real published figures, not just
hand-constructed fixtures.

## 5. API reference

All routes live under `web/app/api/`. Full request/response schemas are generated from the same
Zod schemas used to validate at runtime — see the live Swagger UI at `/api-docs`
(spec served at `/api/openapi.json`, built by `lib/openapi/document.ts`) rather than duplicating
that detail here.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/categories` | List all CPI categories (the series hierarchy) |
| `GET` | `/api/cpi?categories=&from=&to=` | Time-series CPI observations, for charting |
| `GET` | `/api/presets` | Official basket presets (income group → category weights) |
| `POST` | `/api/inflation/personal` | Core calculation: personal vs. headline inflation + per-category contributions |
| `GET` | `/api/insights` | Precomputed insights (503 if no data has been ingested yet) |
| `GET` | `/api/health` | Liveness/readiness (`SELECT 1`) — used directly as the ALB target-group health check |
| `GET` | `/api/ingest` | Manually trigger a CPI ingestion run; requires `Authorization: Bearer <INGEST_SECRET>` |
| `GET` | `/api/openapi.json` | The generated OpenAPI document backing `/api-docs` |

Every Route Handler funnels errors through `lib/http/apiError.ts`'s `toErrorResponse()`, which
turns an `ApiError`, a Zod `ZodError`, or any other thrown error into the same
`{ status: "error", message, details? }` envelope.

## 6. Ingestion pipeline (`lib/ingestion`)

1. **Download** (`datagovsg.ts`) — data.gov.sg's dataset download is a two-step, asynchronous
   process: initiate a download, then poll until it reports `DOWNLOAD_SUCCESS`, then fetch the
   resulting CSV. The current dataset ID is `MONTHLY_CPI_DATASET_ID` in `constants.ts`
   (`d_bdaff844e3ef89d39fceb962ff8f0791`, base year `CPI_BASE_YEAR = 2024`) — verify this is still
   current before relying on it long-term; data.gov.sg dataset IDs and base years do go stale.
2. **Parse** (`parseCpiCsv.ts`) — SingStat exports CPI wide-format: one `DataSeries` label column
   plus one column per month, newest-first, with category hierarchy encoded as leading-space
   indentation on the label rather than an explicit parent column. The parser derives hierarchy
   depth from that indentation, slugifies labels into `code`s (disambiguating duplicates), skips
   `na`/malformed cells, and produces long-format series + observations.
3. **Upsert** (`runIngestion.ts`) — creates an `ingestion_run` row, runs the download + parse, then
   upserts series and observations inside a single database transaction (so a failure partway
   through rolls back cleanly), keyed on `(series_id, period_date)` for observations — safe to
   rerun. Marks the run `success` or `failed` on the way out.

Three ways a run gets triggered — no code difference between them, all three call the same
`runIngestion()`:
- `GET /api/ingest` with a bearer token — ad hoc, manual.
- `npm run ingest:cpi` (`web/scripts/ingest-cpi.ts`) — for local development.
- **Production schedule**: `infra/lib/ingestion-stack.ts` runs the same script as a one-off ECS
  Fargate task, fired by an EventBridge cron rule (default: 06:00 UTC on the 24th of every month —
  a tunable default, not a load-bearing date; SingStat publishes CPI roughly mid-month).

## 7. Infrastructure & deployment (`infra/`)

Three AWS CDK stacks (default region `ap-southeast-1`):

- **`InflationCalculatorNetworkStack`** — a VPC with public and private-with-egress subnets across
  2 AZs, 1 NAT gateway (Fargate tasks need outbound access to reach Aiven and data.gov.sg; there's
  no in-VPC database).
- **`InflationCalculatorAppStack`** — three Secrets Manager secrets (`database-url` and
  `data-gov-sg-api-key`, created empty and populated manually post-deploy since they're
  Aiven/data.gov.sg credentials, not AWS-generated; `ingest-secret`, auto-generated by CDK); an ECS
  cluster; the app image built directly from `web/Dockerfile` via `ecs.ContainerImage.fromAsset`
  (no separate CI/CD pipeline needed to get a working image into ECR); an
  `ApplicationLoadBalancedFargateService` (256 CPU / 512 MiB, 1 task by default, autoscaling 1–2 on
  70% CPU, public ALB, tasks in private subnets, deployment circuit-breaker with rollback); the ALB
  health check pointed at `/api/health`; and CloudWatch alarms (ALB 5xx count, unhealthy host
  count) wired to an SNS topic with an optional email subscription.
- **`InflationCalculatorIngestionStack`** — a separate Fargate **task definition** (not a
  long-running service) running `npx tsx scripts/ingest-cpi.ts` from the same image and secrets,
  fired by the EventBridge cron rule described above, plus an EventBridge rule that watches for
  this task stopping with a non-zero exit code and forwards a failure message to the same SNS
  topic — so a broken monthly ingestion alerts through the same channel as the live service.

**Notably, Postgres is not provisioned by CDK at all** — the app connects to an already-running
Aiven instance over the internet via its connection string in Secrets Manager. This is a deliberate
divergence from the original design brief, which considered RDS; it's also simpler than the
brief's originally-considered split of a static frontend (S3/CloudFront) and separate API
(Lambda/API Gateway) — everything ships as one Next.js container.

See [infra/README.md](../infra/README.md) for the actual deploy commands
(`cdk bootstrap`, `cdk deploy --all -c alertEmail=...`, populating secrets, forcing a redeploy
after a secret change) — this section describes what gets built, not how to run the deploy.

## 8. Testing

(Vitest, `web/vitest.config.mts`, `environment: "node"`):
- Calculation engine unit tests, including the SingStat-validation test described in §4.
- Period-resolution and Zod-schema tests.
- `fast-check`-based property-based tests are available as a devDependency and used per the
  project's testing strategy (e.g. asserting 100% weight in one category ⇒ result equals that
  category's rate; scaling spend leaves the result unchanged).
- Repository tests (`lib/cpi`, `lib/presets`) against a **mocked** `QueryFn`, not a real database.
- Route-level test for `POST /api/inflation/personal`.
- CSV-parsing tests for the ingestion pipeline.
- OpenAPI document generation test.


## 9. Environment variables

Defined in `web/.env.example`:

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | Postgres connection string (Aiven service URI, `sslmode=require`) |
| `DATA_GOV_SG_API_KEY` | No | Raises data.gov.sg rate limits; ingestion works without one at lower limits |
| `INGEST_SECRET` | Yes (for `/api/ingest`) | Bearer token required to trigger a CPI ingestion run over HTTP |

---

For the original problem framing, methodology derivation, and the three-day implementation plan
this project started from, see
[personal-inflation-calculator-brief.md](personal-inflation-calculator-brief.md).
