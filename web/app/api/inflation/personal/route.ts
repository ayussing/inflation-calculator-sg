import { NextResponse, type NextRequest } from "next/server";
import {
  getAvailablePeriods,
  getObservationsByCodesAndPeriods,
  getSeriesByCodes,
} from "@/lib/cpi/repository";
import { ALL_ITEMS_CATEGORY_CODE } from "@/lib/cpi/constants";
import {
  calculateCategoryPercentChange,
  calculatePersonalInflation,
  InvalidCpiValueError,
  MissingCpiObservationError,
  type CategoryObservation,
} from "@/lib/inflation/calculate";
import {
  InvalidPeriodRangeError,
  NoAvailablePeriodsForRangeError,
  resolvePeriod,
} from "@/lib/inflation/period";
import {
  PersonalInflationRequestSchema,
  PersonalInflationResponseSchema,
} from "@/lib/inflation/schema";
import { ApiError, toErrorResponse } from "@/lib/http/apiError";

export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ApiError(400, "Request body must be valid JSON");
    }

    const parsed = PersonalInflationRequestSchema.parse(body);
    const requestedCodes = [...new Set(parsed.categories.map((c) => c.categoryCode))];
    const allCodes = [...new Set([...requestedCodes, ALL_ITEMS_CATEGORY_CODE])];

    const foundSeries = await getSeriesByCodes(allCodes);
    const foundCodes = new Set(foundSeries.map((s) => s.code));
    const unknownCodes = requestedCodes.filter((c) => !foundCodes.has(c));
    if (unknownCodes.length > 0) {
      throw new ApiError(404, `Unknown category code(s): ${unknownCodes.join(", ")}`);
    }

    const availablePeriods = await getAvailablePeriods(ALL_ITEMS_CATEGORY_CODE);
    let resolved;
    try {
      resolved = resolvePeriod({ from: parsed.from, to: parsed.to }, availablePeriods);
    } catch (error) {
      if (error instanceof InvalidPeriodRangeError) throw new ApiError(400, error.message);
      if (error instanceof NoAvailablePeriodsForRangeError) throw new ApiError(422, error.message);
      throw error;
    }

    const observations = await getObservationsByCodesAndPeriods(allCodes, [
      resolved.from,
      resolved.to,
    ]);
    const observationsByCode = new Map<string, { start?: number; end?: number }>();
    for (const obs of observations) {
      const entry = observationsByCode.get(obs.categoryCode) ?? {};
      if (obs.periodDate === resolved.from) entry.start = obs.indexValue;
      if (obs.periodDate === resolved.to) entry.end = obs.indexValue;
      observationsByCode.set(obs.categoryCode, entry);
    }

    const categoryObservations: CategoryObservation[] = parsed.categories.map((c) => {
      const entry = observationsByCode.get(c.categoryCode) ?? {};
      return {
        categoryCode: c.categoryCode,
        spend: c.spend,
        cpiStart: entry.start as number,
        cpiEnd: entry.end as number,
      };
    });

    const allItems = observationsByCode.get(ALL_ITEMS_CATEGORY_CODE) ?? {};
    if (allItems.start === undefined || allItems.end === undefined) {
      throw new ApiError(422, "No CPI data available for the headline all-items series in the resolved period");
    }
    const headlineInflationRate = calculateCategoryPercentChange(allItems.start, allItems.end);

    let result;
    try {
      result = calculatePersonalInflation(categoryObservations);
    } catch (error) {
      if (error instanceof MissingCpiObservationError || error instanceof InvalidCpiValueError) {
        throw new ApiError(422, error.message);
      }
      throw error;
    }

    const response = PersonalInflationResponseSchema.parse({
      personalInflationRate: result.personalInflationRate,
      personalIndexStart: result.personalIndexStart,
      personalIndexEnd: result.personalIndexEnd,
      headlineInflationRate,
      resolvedPeriod: resolved,
      contributions: result.contributions,
    });
    return NextResponse.json(response);
  } catch (error) {
    return toErrorResponse(error);
  }
}
