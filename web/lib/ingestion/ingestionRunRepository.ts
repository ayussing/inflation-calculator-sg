import { query } from "@/lib/db/client";

export async function createIngestionRun(): Promise<number> {
  const rows = await query<{ id: number }>(
    `INSERT INTO ingestion_run (status) VALUES ('running') RETURNING id`
  );
  return rows[0].id;
}

export async function completeIngestionRun(runId: number, rowsUpserted: number): Promise<void> {
  await query(
    `UPDATE ingestion_run
     SET status = 'success', finished_at = now(), rows_upserted = $2
     WHERE id = $1`,
    [runId, rowsUpserted]
  );
}

export async function failIngestionRun(runId: number, error: string): Promise<void> {
  await query(
    `UPDATE ingestion_run
     SET status = 'failed', finished_at = now(), error = $2
     WHERE id = $1`,
    [runId, error]
  );
}
