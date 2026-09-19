import { query, type QueryFn } from "@/lib/db/client";
import type { BasketPreset } from "./schema";

type PresetWeightRow = {
  id: number;
  name: string;
  incomeGroup: string;
  sourceYear: number;
  categoryCode: string | null;
  weightPer10000: number | null;
};

// Presets joined with their category weights, grouped in JS. LEFT JOINs so a preset with zero
// weight rows still comes back (rather than being dropped by an inner join).
export async function getAllPresets(queryFn: QueryFn = query): Promise<BasketPreset[]> {
  const rows = await queryFn<PresetWeightRow>(
    `SELECT p.id, p.name, p.income_group AS "incomeGroup", p.source_year AS "sourceYear",
            s.code AS "categoryCode", w.weight_per_10000 AS "weightPer10000"
     FROM basket_preset p
     LEFT JOIN basket_preset_weight w ON w.preset_id = p.id
     LEFT JOIN cpi_series s ON s.id = w.series_id
     ORDER BY p.id, s.code`
  );

  const byId = new Map<number, BasketPreset>();
  for (const row of rows) {
    let preset = byId.get(row.id);
    if (!preset) {
      preset = {
        id: row.id,
        name: row.name,
        incomeGroup: row.incomeGroup,
        sourceYear: row.sourceYear,
        weights: [],
      };
      byId.set(row.id, preset);
    }
    if (row.categoryCode !== null && row.weightPer10000 !== null) {
      preset.weights.push({ categoryCode: row.categoryCode, weightPer10000: row.weightPer10000 });
    }
  }

  return [...byId.values()];
}
