import { query, type QueryFn } from "@/lib/db/client";
import type { CpiObservation, CpiSeries, NewCpiSeries } from "./schema";

// Upserts one series keyed on `code` (stable across ingestion runs); returns its DB id — either
// the newly-inserted id or the existing row's id on conflict.
export async function upsertSeries(
  series: NewCpiSeries,
  queryFn: QueryFn = query
): Promise<number> {
  const rows = await queryFn<{ id: number }>(
    `INSERT INTO cpi_series (code, name, level, parent_id, base_year)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (code) DO UPDATE
       SET name = EXCLUDED.name,
           level = EXCLUDED.level,
           parent_id = EXCLUDED.parent_id,
           base_year = EXCLUDED.base_year
     RETURNING id`,
    [series.code, series.name, series.level, series.parentId, series.baseYear]
  );
  return rows[0].id;
}

// Batch-upserts observations keyed on (series_id, period_date), chunked to stay well under
// Postgres's 65535-parameter limit (3 params/row => 1000 rows/chunk = 3000 params/statement).
// Returns the total number of rows upserted.
export async function upsertObservations(
  observations: CpiObservation[],
  queryFn: QueryFn = query
): Promise<number> {
  const CHUNK_SIZE = 1000;
  let upserted = 0;

  for (let i = 0; i < observations.length; i += CHUNK_SIZE) {
    const chunk = observations.slice(i, i + CHUNK_SIZE);
    const values: unknown[] = [];
    const placeholders = chunk.map((obs, idx) => {
      const base = idx * 3;
      values.push(obs.seriesId, obs.periodDate, obs.indexValue);
      return `($${base + 1}, $${base + 2}, $${base + 3})`;
    });

    await queryFn(
      `INSERT INTO cpi_observation (series_id, period_date, index_value)
       VALUES ${placeholders.join(", ")}
       ON CONFLICT (series_id, period_date) DO UPDATE
         SET index_value = EXCLUDED.index_value`,
      values
    );
    upserted += chunk.length;
  }

  return upserted;
}

// Used by future API routes (e.g. /api/categories) and by manual verification.
export async function getAllSeries(queryFn: QueryFn = query): Promise<CpiSeries[]> {
  return queryFn<CpiSeries>(
    `SELECT id, code, name, level, parent_id AS "parentId", base_year AS "baseYear"
     FROM cpi_series
     ORDER BY id`
  );
}

// Looks up series by code; used to validate requested category codes exist before querying
// observations for them. Returns only the series that were found — callers diff against the
// requested codes to report unknown ones.
export async function getSeriesByCodes(
  codes: string[],
  queryFn: QueryFn = query
): Promise<CpiSeries[]> {
  if (codes.length === 0) return [];
  return queryFn<CpiSeries>(
    `SELECT id, code, name, level, parent_id AS "parentId", base_year AS "baseYear"
     FROM cpi_series
     WHERE code = ANY($1)
     ORDER BY id`,
    [codes]
  );
}

// Sorted list of period dates actually ingested for one series (e.g. the "all-items" headline
// series), used as the `availablePeriods` input to lib/inflation/period.ts's resolvePeriod.
export async function getAvailablePeriods(
  seriesCode: string,
  queryFn: QueryFn = query
): Promise<string[]> {
  const rows = await queryFn<{ periodDate: string }>(
    `SELECT o.period_date::text AS "periodDate"
     FROM cpi_observation o
     JOIN cpi_series s ON s.id = o.series_id
     WHERE s.code = $1
     ORDER BY o.period_date`,
    [seriesCode]
  );
  return rows.map((r) => r.periodDate);
}

export type CategoryObservationRow = {
  categoryCode: string;
  periodDate: string;
  indexValue: number;
};

// Long-format observations for a set of category codes over an inclusive date range (either bound
// omittable), ordered for charting. `index_value` is `numeric` in Postgres, which `pg` returns as
// a string — cast to Number here so every caller gets real numbers.
export async function getObservationsByCodesInRange(
  codes: string[],
  range: { from?: string; to?: string },
  queryFn: QueryFn = query
): Promise<CategoryObservationRow[]> {
  if (codes.length === 0) return [];
  const conditions = ["s.code = ANY($1)"];
  const params: unknown[] = [codes];
  if (range.from) {
    params.push(range.from);
    conditions.push(`o.period_date >= $${params.length}`);
  }
  if (range.to) {
    params.push(range.to);
    conditions.push(`o.period_date <= $${params.length}`);
  }

  const rows = await queryFn<{ categoryCode: string; periodDate: string; indexValue: string }>(
    `SELECT s.code AS "categoryCode", o.period_date::text AS "periodDate", o.index_value AS "indexValue"
     FROM cpi_observation o
     JOIN cpi_series s ON s.id = o.series_id
     WHERE ${conditions.join(" AND ")}
     ORDER BY s.code, o.period_date`,
    params
  );
  return rows.map((r) => ({ ...r, indexValue: Number(r.indexValue) }));
}

// Point-in-time observations for a set of category codes at a specific set of period dates (e.g.
// exactly the resolved start/end of a requested range). Same numeric-string cast as above.
export async function getObservationsByCodesAndPeriods(
  codes: string[],
  periodDates: string[],
  queryFn: QueryFn = query
): Promise<CategoryObservationRow[]> {
  if (codes.length === 0 || periodDates.length === 0) return [];
  const rows = await queryFn<{ categoryCode: string; periodDate: string; indexValue: string }>(
    `SELECT s.code AS "categoryCode", o.period_date::text AS "periodDate", o.index_value AS "indexValue"
     FROM cpi_observation o
     JOIN cpi_series s ON s.id = o.series_id
     WHERE s.code = ANY($1) AND o.period_date = ANY($2::date[])
     ORDER BY s.code, o.period_date`,
    [codes, periodDates]
  );
  return rows.map((r) => ({ ...r, indexValue: Number(r.indexValue) }));
}
