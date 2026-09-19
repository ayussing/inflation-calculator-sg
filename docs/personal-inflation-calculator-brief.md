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
personal_index[t]  = Σ ( w_i × CPI_i[t] )
personal_inflation = ( personal_index[end] / personal_index[start] - 1 ) × 100

  w_i = user's share of total spending in category i  (weights normalised to sum to 1)
```

Note: the simpler form `Σ ( w_i × r_i )` (where `r_i` is each category's own percentage change)
is only exact when every category starts at the same index level. The ratio form above is the
correct Laspeyres calculation and is the one the validation test checks against.

### Category contribution

```
contribution_i = w_i × ( CPI_i[end] - CPI_i[start] ) / personal_index[start] × 100
```

Contributions sum exactly to `personal_inflation`. Expressed as a share of the total, this powers
the headline insight, for example: "Transport drove 60% of your inflation."

### Index change for a single category (used for charts and the category explorer)

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

All series below use **2024 as the base year** (rebased from 2019 in February 2025). Weights come
from the Household Expenditure Survey (HES) 2023, updated to 2024 prices.

| Series | Use in the app | Frequency | Dataset ID |
|---|---|---|---|
| CPI, 2024 as base year (all items, divisions, groups, classes) | Main calculation inputs, category explorer | Monthly | `d_bdaff844e3ef89d39fceb962ff8f0791` |
| CPI at group level (finer sub-categories, same dataset as above) | Stretch goal: greater granularity | Monthly | same as above |
| CPI by household income group (lowest 20%, middle 60%, highest 20%), 2024 base | Preset baskets and the income comparison insight | Half-yearly | to confirm |
| Percent change in CPI by household income group | Cross-check and insight content | Annual | to confirm |
| CPI Additional Indicators, 2024 base (includes "All Items less Imputed Rentals for Housing") | Homeowner toggle | Monthly | to confirm |

Terminology: what used to be called "less imputed rentals on owner-occupied accommodation (OOA)"
is now called **"less Imputed Rentals for Housing."**

### Division-level categories (2024 base)

Food; Clothing & Footwear; Housing & Utilities; Household Durables & Services; Health;
Transport; Information & Communication; Recreation, Sport & Culture; Education;
Miscellaneous Goods & Services.

Three names changed from the 2019 base: Health Care became **Health**, Communication became
**Information & Communication**, and Recreation & Culture became **Recreation, Sport & Culture**.

### Official basket weights (per 10,000), 2024-based series

Source: SingStat press release, CPI by Household Income Group, Jul to Dec 2025 (Annex 1).
Use these to seed `basket_preset_weight`.

| Division | General | Lowest 20% | Middle 60% | Highest 20% |
|---|---|---|---|---|
| Food | 2,042 | 2,262 | 2,177 | 1,742 |
| Clothing & Footwear | 165 | 120 | 166 | 177 |
| Housing & Utilities | 2,938 | 3,256 | 2,835 | 2,987 |
| Household Durables & Services | 547 | 571 | 519 | 588 |
| Health | 1,008 | 1,169 | 1,080 | 807 |
| Transport | 1,307 | 875 | 1,206 | 1,642 |
| Information & Communication | 381 | 455 | 410 | 310 |
| Recreation, Sport & Culture | 595 | 380 | 571 | 723 |
| Education | 579 | 517 | 580 | 607 |
| Miscellaneous Goods & Services | 438 | 395 | 456 | 417 |
| **Total** | 10,000 | 10,000 | 10,000 | 10,000 |
| All Items less Imputed Rentals for Housing | 7,862 | 7,556 | 7,900 | 7,925 |

**Income group definition changed.** For the 2024-based series, households are ranked by monthly
household income *per household member* (previously total household income). The 2024-based
groups are therefore not directly comparable with older income group series. Mention this in the
README.

### Supporting evidence for the premise

SingStat's own commentary confirms that income groups experience different inflation. For 2025,
CPI-All Items inflation was 0.6% for the lowest 20%, 0.9% for the middle 60%, and 1.2% for the
highest 20%. The highest 20% saw the largest increase excluding imputed rentals, mainly because
motor cars make up a bigger share of its spending basket.

### Notes on the monthly dataset

- **Base year / rebasing: resolved.** The current base is 2024. The division-level series already
  run back to Jan 1961 on the 2024 base, so SingStat has done the linking and no manual splicing
  is needed.
- **Dataset IDs.** The monthly ID is confirmed above. Confirm the remaining `d_xxxxx` IDs on the
  portal. They do change.
- **CSV shape.** About 207 rows (one per series) by 788 columns (one per month), under 1 MB.
  - Columns run **newest first** (2026 Jul, 2026 Jun, ...). Do not assume chronological order.
  - Older columns contain `na` for sub-series that did not exist yet, so they are typed as text.
    Parse with `na` handling rather than trusting column types.
  - The hierarchy is encoded as **leading spaces** in the `DataSeries` label (" Food",
    "  Food Excl Food & Beverage Serving Services", ...). Derive `level` and `parent_id` from the
    indentation depth.
  - Some labels may repeat under different parents, so key series on their full ancestor path,
    not the label alone.

### API access and rate limits

- data.gov.sg enforces rate limits, reset every 10 seconds, and limits are significantly lower for
  callers without an API key.
- Sample endpoint: `https://data.gov.sg/api/action/datastore_search?resource_id=<dataset_id>`.
  Since the full monthly CSV is under 1 MB, downloading the whole file once per ingestion run is
  simpler than paging through rows.
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
- **Homeowner toggle:** imputed rent on owner-occupied homes is a large part of the Housing
  category but is not a cash outlay for owners. Switching to the "less Imputed Rentals for
  Housing" series shows genuine understanding of the data. For a personal basket, this means
  removing the imputed rentals component from the user's Housing weight, so check whether that
  row exists in the monthly dataset or use the Additional Indicators dataset.
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
6. **Rebasing strategy.** Use SingStat's linked history on the 2024 base rather than splicing
   series manually. State that the underlying basket weights changed at each rebase (every five
   years), so long-range results are approximate, and that the income group definition changed
   with the 2024 base.
7. **Choice of division level over group level.** Fewer inputs means a usable form; group level is
   noted as a future enhancement.

---

## 7. Testing strategy

### Validation test (the standout one)

Feed SingStat's official general household weights into the calculation engine and assert that
the output matches the official All Items CPI, within a small tolerance (about 0.05 index points).
This proves correctness against real published figures.

For any month from Jan 2024 onward, this identity should hold (up to rounding):

```
All_Items[t] ≈ Σ ( w_i × Division_i[t] ) / 10,000
```

Limit the test to periods from Jan 2024 onward. Earlier months were aggregated with older baskets,
so they will not reproduce exactly. That limitation is worth explaining in the README.

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

- [x] Confirm the current CPI base year and whether a rebase has occurred (2024 base, rebased Feb 2025)
- [x] Record the monthly CPI dataset ID (`d_bdaff844e3ef89d39fceb962ff8f0791`)
- [ ] Record the dataset IDs for the income group and Additional Indicators series
- [ ] Update category names and preset weights in seed data to the 2024 base
- [ ] Check whether an "Imputed Rentals for Housing" row exists in the monthly dataset
- [ ] Obtain a data.gov.sg developer API key
- [ ] Choose the tech stack (backend language, ORM, chart library)
- [ ] Decide between Terraform and AWS CDK
- [ ] Choose which differentiator feature to build