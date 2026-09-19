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
