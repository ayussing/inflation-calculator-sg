import { query as defaultQuery, type QueryFn } from "@/lib/db/client";
import { DIVISION_LEVEL, ALL_ITEMS_CATEGORY_CODE } from "@/lib/cpi/constants";
import {
  getAllSeries,
  getAvailablePeriods,
  getObservationsByCodesAndPeriods,
  getObservationsByCodesInRange,
} from "@/lib/cpi/repository";
import { getAllPresets } from "@/lib/presets/repository";
import {
  calculateCategoryPercentChange,
  calculatePersonalInflation,
  type CategoryObservation,
} from "@/lib/inflation/calculate";
import { resolvePeriod } from "@/lib/inflation/period";
import { calculateVolatility, subtractMonths, subtractYears } from "./compute";
import type { InsightsResponse } from "./schema";

const VOLATILITY_WINDOW_MONTHS = 24;
const TOP_N = 5;

function indexAtPeriods(
  observations: { categoryCode: string; periodDate: string; indexValue: number }[],
  from: string,
  to: string
): Map<string, { start?: number; end?: number }> {
  const byCode = new Map<string, { start?: number; end?: number }>();
  for (const obs of observations) {
    const entry = byCode.get(obs.categoryCode) ?? {};
    if (obs.periodDate === from) entry.start = obs.indexValue;
    if (obs.periodDate === to) entry.end = obs.indexValue;
    byCode.set(obs.categoryCode, entry);
  }
  return byCode;
}

// Orchestrates the three insight computations from ingested CPI + preset data. Returns null when
// no CPI data has been ingested yet, so the route can respond 503 rather than crash. "Precomputed"
// here means general/global stats (not tied to a single user's basket) computed live at request
// time — there is no dedicated insights table in the data model.
export async function getInsights(queryFn: QueryFn = defaultQuery): Promise<InsightsResponse | null> {
  const availablePeriods = await getAvailablePeriods(ALL_ITEMS_CATEGORY_CODE, queryFn);
  if (availablePeriods.length === 0) return null;
  const today = availablePeriods[availablePeriods.length - 1];

  const allSeries = await getAllSeries(queryFn);
  const divisionCodes = allSeries.filter((s) => s.level === DIVISION_LEVEL).map((s) => s.code);

  const highestInflationByWindow = await Promise.all(
    [1, 5, 10].map(async (years) => {
      const resolved = resolvePeriod({ from: subtractYears(today, years), to: today }, availablePeriods);
      const insufficientData = resolved.from === resolved.to;

      let topCategories: { categoryCode: string; percentChange: number }[] = [];
      if (!insufficientData) {
        const observations = await getObservationsByCodesAndPeriods(
          divisionCodes,
          [resolved.from, resolved.to],
          queryFn
        );
        const byCode = indexAtPeriods(observations, resolved.from, resolved.to);
        topCategories = [...byCode.entries()]
          .filter(([, v]) => v.start !== undefined && v.end !== undefined)
          .map(([categoryCode, v]) => ({
            categoryCode,
            percentChange: calculateCategoryPercentChange(v.start as number, v.end as number),
          }))
          .sort((a, b) => b.percentChange - a.percentChange)
          .slice(0, TOP_N);
      }

      return {
        years,
        from: resolved.from,
        to: resolved.to,
        warnings: resolved.warnings,
        insufficientData,
        topCategories,
      };
    })
  );

  const oneYearWindow = highestInflationByWindow.find((w) => w.years === 1)!;
  const presets = await getAllPresets(queryFn);
  const presetCodes = [...new Set(presets.flatMap((p) => p.weights.map((w) => w.categoryCode)))];
  const presetObservations =
    presetCodes.length > 0
      ? await getObservationsByCodesAndPeriods(presetCodes, [oneYearWindow.from, oneYearWindow.to], queryFn)
      : [];
  const presetObsByCode = indexAtPeriods(presetObservations, oneYearWindow.from, oneYearWindow.to);

  const byIncomeGroup = presets
    .map((preset) => {
      const categories: CategoryObservation[] = preset.weights
        .map((w) => {
          const entry = presetObsByCode.get(w.categoryCode);
          if (!entry || entry.start === undefined || entry.end === undefined) return null;
          return {
            categoryCode: w.categoryCode,
            spend: w.weightPer10000,
            cpiStart: entry.start,
            cpiEnd: entry.end,
          };
        })
        .filter((c): c is CategoryObservation => c !== null);
      if (categories.length === 0) return null;
      const result = calculatePersonalInflation(categories);
      return {
        presetId: preset.id,
        name: preset.name,
        incomeGroup: preset.incomeGroup,
        personalInflationRate: result.personalInflationRate,
      };
    })
    .filter((g): g is NonNullable<typeof g> => g !== null);

  const rates = byIncomeGroup.map((g) => g.personalInflationRate);
  const divergencePoints = rates.length > 0 ? Math.max(...rates) - Math.min(...rates) : 0;

  const volatilityResolved = resolvePeriod(
    { from: subtractMonths(today, VOLATILITY_WINDOW_MONTHS), to: today },
    availablePeriods
  );
  const volatilityObservations = await getObservationsByCodesInRange(
    divisionCodes,
    { from: volatilityResolved.from, to: volatilityResolved.to },
    queryFn
  );
  const observationsByCode = new Map<string, { periodDate: string; indexValue: number }[]>();
  for (const obs of volatilityObservations) {
    const arr = observationsByCode.get(obs.categoryCode) ?? [];
    arr.push({ periodDate: obs.periodDate, indexValue: obs.indexValue });
    observationsByCode.set(obs.categoryCode, arr);
  }
  const mostVolatileCategories = [...observationsByCode.entries()]
    .map(([categoryCode, obs]) => ({
      categoryCode,
      volatility: calculateVolatility(obs),
      monthsObserved: obs.length,
    }))
    .filter((c): c is { categoryCode: string; volatility: number; monthsObserved: number } => c.volatility !== null)
    .sort((a, b) => b.volatility - a.volatility)
    .slice(0, TOP_N);

  return {
    asOf: today,
    highestInflationByWindow,
    incomeGroupDivergence: {
      from: oneYearWindow.from,
      to: oneYearWindow.to,
      warnings: oneYearWindow.warnings,
      byIncomeGroup,
      divergencePoints,
    },
    mostVolatileCategories: {
      windowMonths: VOLATILITY_WINDOW_MONTHS,
      from: volatilityResolved.from,
      to: volatilityResolved.to,
      categories: mostVolatileCategories,
    },
  };
}
