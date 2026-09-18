# Personal Inflation Calculator (SG)

Answers one question: **"How much have prices risen for someone who spends like me?"**

The official Consumer Price Index (CPI) tracks price changes for an *average* household's basket
of goods, but no one spends exactly like the average household. This app takes a user's monthly
spending by category, computes their personal inflation rate using official Singapore CPI data
from data.gov.sg / SingStat, and compares it against the headline rate.

## How it works

1. User enters (or adjusts a preset for) monthly spending across CPI categories such as Food,
   Housing & Utilities, and Transport.
2. The backend computes a weighted personal inflation rate from official category-level CPI
   changes over the selected period.
3. Results show the personal rate vs. the official rate, plus which categories drove the
   difference.

CPI data is ingested from data.gov.sg on a schedule and stored in Postgres; the app never proxies
live API calls per request, and user spending is never stored server-side.

## Status

Early planning stage. Architecture, data model, and feature scope are still being defined.

## Stack

- Frontend + backend: Next.js (single app — API routes serve as the calculation engine)
- Database: PostgreSQL, hosted on Aiven
- Infrastructure: `npm run dev` locally; deployment target still open
