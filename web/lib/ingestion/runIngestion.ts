import { withTransaction } from "@/lib/db/client";
import { upsertObservations, upsertSeries } from "@/lib/cpi/repository";
import type { CpiObservation } from "@/lib/cpi/schema";
import { downloadDatasetCsv } from "./datagovsg";
import { CPI_BASE_YEAR, MONTHLY_CPI_DATASET_ID } from "./constants";
import {
  completeIngestionRun,
  createIngestionRun,
  failIngestionRun,
} from "./ingestionRunRepository";
import { parseCpiCsv } from "./parseCpiCsv";

export type IngestionResult = {
  runId: number;
  status: "success" | "failed";
  rowsUpserted: number;
  error?: string;
};

export async function runIngestion(): Promise<IngestionResult> {
  const runId = await createIngestionRun();

  try {
    const csvText = await downloadDatasetCsv({
      datasetId: MONTHLY_CPI_DATASET_ID,
      apiKey: process.env.DATA_GOV_SG_API_KEY,
    });
    const parsed = parseCpiCsv(csvText, CPI_BASE_YEAR);

    // Series and observation upserts run in one transaction: if anything fails partway,
    // ROLLBACK leaves cpi_series/cpi_observation exactly as the previous successful run left
    // them — no half-updated state. Slow I/O (download, CSV parse) intentionally happens
    // *before* acquiring the transaction's client, so we never hold a DB connection open
    // during network calls.
    const rowsUpserted = await withTransaction(async (txQuery) => {
      const codeToId = new Map<string, number>();

      for (const s of parsed.series) {
        const parentId = s.parentCode ? (codeToId.get(s.parentCode) ?? null) : null;
        const id = await upsertSeries(
          { code: s.code, name: s.name, level: s.level, parentId, baseYear: CPI_BASE_YEAR },
          txQuery
        );
        codeToId.set(s.code, id);
      }

      const observations: CpiObservation[] = parsed.observations.map((obs) => {
        const seriesId = codeToId.get(obs.seriesCode);
        if (seriesId === undefined) {
          throw new Error(`No series id resolved for code "${obs.seriesCode}"`);
        }
        return { seriesId, periodDate: obs.periodDate, indexValue: obs.indexValue };
      });

      return upsertObservations(observations, txQuery);
    });

    await completeIngestionRun(runId, rowsUpserted);
    return { runId, status: "success", rowsUpserted };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await failIngestionRun(runId, message);
    return { runId, status: "failed", rowsUpserted: 0, error: message };
  }
}
