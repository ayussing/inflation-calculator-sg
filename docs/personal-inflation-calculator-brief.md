# Personal Inflation Calculator: Project Brief

Reference notes for the data.gov.sg full-stack take-home assignment.

Last updated: 18 September 2026

---

## 1. Concept

The official Consumer Price Index (CPI) measures price changes for an *average* household's
basket of goods. No one spends like the average household, so each person's real inflation rate
differs from the headline figure.

The app answers one question:

> **"How much have prices risen for someone who spends like me?"**

A user enters roughly how much they spend per category each month. The app returns their personal
inflation rate, compares it against the official rate, and shows which categories drove the
difference.

### Why this works as an assignment

- The backend performs a real computation (a weighted index) rather than just filtering rows,
  which gives a strong, highly testable core.
- The methodology is simple enough to explain and defend in an interview.
- The dataset is modest in size, leaving time for UX, testing, IaC, and documentation.
- There is a clean privacy story: user spending never has to be stored.

---

## 2. Methodology

### Core formula

```
personal_inflation = Σ ( w_i × r_i )

  w_i = user's share of total spending in category i  (weights normalised to sum to 1)
  r_i = percentage price change of category i over the selected period
```

### Category contribution

For each category, contribution = `w_i × r_i`. Expressed as a share of the total, this powers the
headline insight, for example: "Transport drove 60% of your inflation."

### Index change over a period

```
r_i = (CPI_i[end_period] / CPI_i[start_period] - 1) × 100
```

### Purchasing power conversion

```
equivalent_cost_today = amount × (personal_index[today] / personal_index[base])
```

where `personal_index[t] = Σ ( w_i × CPI_i[t] )`.

### Known limitations (state these openly in the README)

- This is a Laspeyres-style fixed-basket approximation. It assumes the user's spending pattern
  stayed constant over the whole period, which is never quite true.
- It ignores substitution effects, where people buy less of something as its price rises.
- Category-level indices are national averages. Individual prices inside a category vary.
- Quality adjustments made by SingStat inside each index are inherited, not recomputed.

---

## 3. Data sources (data.gov.sg / SingStat)

| Series | Use in the app | Frequency |
|---|---|---|
| CPI at division level (about 10 broad categories) | Main calculation inputs | Monthly |
| CPI at group level (finer sub-categories) | Stretch goal: greater granularity | Monthly |
| CPI by household income group (lowest 20%, middle 60%, highest 20%) | Preset baskets and the income comparison insight | Half-yearly |
| Percent change in CPI by household income group | Cross-check and insight content | Annual |
| CPI all items less imputed rentals on owner-occupied accommodation (OOA) | Homeowner toggle | Monthly |

### Division-level categories (2019 base)

Food; Clothing & Footwear; Housing & Utilities; Household Durables & Services; Health Care;
Transport; Communication; Recreation & Culture; Education; Miscellaneous Goods & Services.

### Official basket weights (per 10,000), 2014-based series

Included to show how differently income groups spend. Verify against the current base year
before using these numbers in the app.

| Income group | Food | Housing & Utilities | Transport | Education |
|---|---|---|---|---|
| General households | 2167 | 2625 | 1579 | 615 |
| Lowest 20% | 2435 | 4002 | 732 | 261 |
| Middle 60% | 2360 | 2615 | 1404 | 602 |
| Highest 20% | 1835 | 2396 | 1984 | 700 |

### Supporting evidence for the premise

SingStat's own commentary confirms that income groups experience different inflation. In 2023, the
lowest 20% income group recorded the smallest CPI increase excluding OOA, partly because car
prices and holiday expenses made up a smaller share of its spending basket.

### Things to verify before building

1. **Base year / rebasing.** The current series derive their weights from the Household
   Expenditure Survey conducted between October 2017 and September 2018, with 2019 as the base
   year. Check whether a newer base year has been published. Splicing an old series onto a new one
   is worth documenting as a design decision.
2. **Exact dataset IDs.** Confirm each `d_xxxxx` dataset ID on the portal. They do change.
3. **CSV shape.** These SingStat exports arrive wide (one column per period), with mixed text and
   numeric columns, `na` values, and footnote rows.

### API access and rate limits

- data.gov.sg enforces rate limits, reset every 10 seconds, and limits are significantly lower for
  callers without an API key.
- Obtain a developer API key by logging in to the data.gov.sg dashboard. Store it in AWS Secrets
  Manager (or a `.env` file locally), never in the repository.
- **Design implication:** ingest the CPI data into your own database on a schedule. Do not proxy
  live calls per user request. This is a defensible architectural decision, not just a
  convenience.

---

## 4. Features

### MVP

- **Spending input:** enter monthly dollar amounts per category, or adjust percentage sliders,
  with a live pie or bar chart of the resulting basket.
- **Presets:** start from a typical lowest 20%, middle 60%, or highest 20% household, then adjust.
- **Time range selector:** last 12 months, last 5 years, last 10 years, or a custom range.
- **Result panel:** "Your inflation: X% vs official Y%," with a contribution breakdown by category.
- **Category explorer:** line charts of each category index over time, with multi-category overlay.

### Differentiators (pick one or two)

- **Purchasing power converter:** "S$100 of your basket in 2019 costs S$X today."
- **What-if scenarios:** for example, "What if I sell my car?" reallocates transport spending and
  recalculates.
- **Homeowner toggle:** imputed rent on owner-occupied accommodation is a large part of the
  Housing category but is not a cash outlay for owners. Switching to the "less OOA" series shows
  genuine understanding of the data.
- **Shareable link:** encode the basket into the URL so results can be shared with nothing stored
  server-side.
- **Insights page:** highest-inflation categories over 1, 5, and 10 years; the gap between income
  groups; most volatile categories.

### Stretch goals

- Group-level granularity, for example hawker food versus groceries.
- Salary check: "Did your raise beat your personal inflation?"
- PDF export of results.

---

## 5. Architecture

### Components

```
                         ┌──────────────────────┐
                         │   data.gov.sg API    │
                         └──────────┬───────────┘
                                    │ scheduled pull (monthly)
                                    ▼
┌────────────┐      ┌───────────────────────────┐      ┌──────────────┐
│  Frontend  │─────▶│      API service          │─────▶│  PostgreSQL  │
│  (React)   │◀─────│  (calculation engine)     │◀─────│  (CPI store) │
└────────────┘      └───────────────────────────┘      └──────────────┘
```

### Local environment

Everything runs under Docker Compose: frontend, API, Postgres, and the ingestion worker. A single
`make up` or `docker compose up` should be enough for a reviewer to run the whole thing.

### AWS (Infrastructure as Code, using Terraform or AWS CDK)

| Concern | Service |
|---|---|
| Frontend hosting | S3 + CloudFront |
| API | ECS Fargate, or Lambda + API Gateway |
| Database | RDS PostgreSQL |
| Scheduled ingestion | EventBridge rule triggering a Lambda or ECS task |
| Secrets | Secrets Manager (data.gov.sg API key, DB credentials) |
| Networking | VPC with public and private subnets, security groups |
| Observability | CloudWatch logs, metrics, and an alarm on ingestion failure |

### Suggested API surface

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/categories` | List categories with metadata |
| `GET` | `/api/cpi?categories=&from=&to=` | Time series for charting |
| `GET` | `/api/presets` | Official basket weights by income group |
| `POST` | `/api/inflation/personal` | Core calculation: basket plus period in, rate plus contributions out |
| `GET` | `/api/insights` | Precomputed summary insights |
| `GET` | `/health` | Liveness and readiness |

### Data model

Store CPI data in long format rather than the wide CSV shape:

```
cpi_series (id, code, name, level, parent_id, base_year)
cpi_observation (series_id, period_date, index_value)   -- unique (series_id, period_date)
basket_preset (id, name, income_group, source_year)
basket_preset_weight (preset_id, series_id, weight_per_10000)
ingestion_run (id, started_at, finished_at, status, rows_upserted, error)
```

Index on `(series_id, period_date)`. Ingestion should be idempotent, using upserts keyed on that
pair so reruns are safe.

---

## 6. Design decisions to document

1. **Calculation lives in the backend.** One source of truth, easy to test in isolation, and the
   API stays reusable. The cost is a network round trip, which is acceptable since the computation
   is cheap and infrequent.
2. **Ingest and cache, do not proxy.** Respects rate limits, keeps response times low, and keeps
   the app working if data.gov.sg is briefly unavailable. The trade-off is data staleness bounded
   by the ingestion schedule, which is fine for a monthly series.
3. **No storage of user spending.** The calculation endpoint is stateless and shareable links keep
   the basket client-side, so there is no personal financial data at rest.
4. **Long-format storage.** Wide-to-long normalisation happens once at ingestion time, so query
   logic stays simple and new periods do not require schema changes.
5. **Weight normalisation.** User inputs rarely sum neatly, so normalise internally and display
   rounded values. Document the rounding rule.
6. **Rebasing strategy.** Decide whether to splice series across base years or restrict the
   selectable range to one base, and say why.
7. **Choice of division level over group level.** Fewer inputs means a usable form; group level is
   noted as a future enhancement.

---

## 7. Testing strategy

### Validation test (the standout one)

Feed SingStat's official basket weights into the calculation engine and assert that the output
matches the official all-items CPI change for the same period, within a small tolerance. This
proves correctness against real published figures.

### Unit tests

- Contribution figures sum to the total inflation rate.
- Weight normalisation handles inputs that do not sum to 100.
- Period selection handles missing months, partial years, and reversed date ranges.
- Purchasing power conversion round-trips correctly.

### Property-based tests

- 100% of spending in one category means the result equals that category's inflation.
- Scaling every spending amount by the same factor leaves the result unchanged.
- The result always lies between the minimum and maximum category inflation rates.

### Integration tests

- Ingestion against a real Postgres instance, using Testcontainers.
- Fixture CSVs containing `na` values, footnote rows, and mixed-type columns.
- A mocked data.gov.sg client, so tests never depend on the live API.
- Idempotency: running ingestion twice produces the same row count.

### End-to-end tests (Playwright)

- Select a preset, adjust a slider, and confirm the result updates.
- Share link round-trip: copy the URL, reload, and confirm the basket is restored.

### CI

GitHub Actions running lint, unit and integration tests, a build, and `terraform validate` or
`cdk synth`.

---

## 8. Three-day plan

**Day 1: data and core logic**
- Explore the datasets and confirm dataset IDs and shapes.
- Build the database schema and the ingestion pipeline.
- Write the calculation engine with full unit and property tests.
- Get the validation test against official weights passing.

**Day 2: API and frontend**
- Implement the API endpoints with request validation.
- Build the spending input, results panel, and category explorer.
- Wire up presets and the time range selector.

**Day 3: polish and deliverables**
- Add one differentiator feature.
- Write the IaC and get CI green.
- Write the README with an architecture diagram, setup instructions, and decision records.
- Record a short demo GIF or screenshots for the README.

---

## 9. Mapping to the assignment requirements

| Requirement | How this project meets it |
|---|---|
| Retrieve and integrate data.gov.sg data | Scheduled ingestion of multiple CPI series into Postgres |
| Clear, user-friendly interface | Guided spending input with presets, live charts, plain-language results |
| Capabilities to explore and interact | Sliders, category overlays, time range selection, what-if scenarios |
| Meaningful summaries or insights (optional) | Personal vs official comparison, contribution breakdown, income group divergence, insights page |
| Sound frontend and backend design | Layered API, stateless calculation service, normalised data model, documented API contract |
| Infrastructure as Code | Terraform or CDK covering VPC, RDS, compute, scheduling, secrets, and observability |
| Automated testing | Unit, property-based, integration, and end-to-end tests, running in CI |
| Technical documentation | README with architecture diagram, setup guide, decision records, and a methodology note |

---

## 10. Open items

- [ ] Confirm the current CPI base year and whether a rebase has occurred
- [ ] Record the exact dataset IDs in use
- [ ] Obtain a data.gov.sg developer API key
- [ ] Choose the tech stack (backend language, ORM, chart library)
- [ ] Decide between Terraform and AWS CDK
- [ ] Choose which differentiator feature to build
