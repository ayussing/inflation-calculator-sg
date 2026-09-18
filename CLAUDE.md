# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

This repository is in the **planning stage** — there is no application code, package manifest, or
build tooling yet. Only `README.md` (public-facing project description) and
`personal-inflation-calculator-brief.md` (detailed design reference, gitignored — not part of the
committed codebase) exist. There are no build, lint, or test commands to run because no source
tree has been created yet.

When asked to bootstrap the project, follow the architecture and decisions below rather than
inventing a different structure.

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
data.gov.sg API --(scheduled monthly pull)--> Postgres (long-format CPI store)
                                                    ^
Frontend (React) <---> API service (calculation engine) <---> Postgres
```

Key decisions to preserve when implementing:

1. **Calculation logic lives entirely in the backend** — one source of truth, testable in
   isolation. The API is stateless.
2. **Ingest and cache CPI data on a schedule; never proxy data.gov.sg per request.** data.gov.sg
   rate-limits aggressively, and this keeps the app responsive and resilient to upstream outages.
3. **User spending data is never persisted server-side.** Baskets are shareable via URL-encoding,
   not database storage — this is a stated privacy/design differentiator, not an oversight.
4. **CPI data is stored long-format**, not as the wide per-period CSV shape SingStat exports it in.
   Wide-to-long normalization happens once, at ingestion time.
5. **Ingestion must be idempotent** — upsert keyed on `(series_id, period_date)` so reruns are safe.

### Planned data model

```
cpi_series (id, code, name, level, parent_id, base_year)
cpi_observation (series_id, period_date, index_value)   -- unique (series_id, period_date)
basket_preset (id, name, income_group, source_year)
basket_preset_weight (preset_id, series_id, weight_per_10000)
ingestion_run (id, started_at, finished_at, status, rows_upserted, error)
```

### Planned API surface

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/categories` | List categories with metadata |
| `GET` | `/api/cpi?categories=&from=&to=` | Time series for charting |
| `GET` | `/api/presets` | Official basket weights by income group |
| `POST` | `/api/inflation/personal` | Core calculation: basket + period in, rate + contributions out |
| `GET` | `/api/insights` | Precomputed summary insights |
| `GET` | `/health` | Liveness and readiness |

## Stack (as planned in README.md)

- Frontend: React
- Backend: API service with a calculation engine
- Database: PostgreSQL
- Local dev: Docker Compose (frontend, API, Postgres, ingestion worker) — a single
  `docker compose up` should run the whole stack
- Deployment: AWS via Terraform or AWS CDK (S3+CloudFront for frontend, ECS Fargate or
  Lambda+API Gateway for the API, RDS Postgres, EventBridge-scheduled ingestion)

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
