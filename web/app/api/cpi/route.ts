import { NextResponse, type NextRequest } from "next/server";
import { getObservationsByCodesInRange, getSeriesByCodes } from "@/lib/cpi/repository";
import { CpiQuerySchema, CpiResponseSchema } from "@/lib/cpi/schema";
import { ApiError, toErrorResponse } from "@/lib/http/apiError";

export async function GET(request: NextRequest) {
  try {
    const query = CpiQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));

    const foundSeries = await getSeriesByCodes(query.categories);
    const foundCodes = new Set(foundSeries.map((s) => s.code));
    const unknownCodes = query.categories.filter((c) => !foundCodes.has(c));
    if (unknownCodes.length > 0) {
      throw new ApiError(404, `Unknown category code(s): ${unknownCodes.join(", ")}`);
    }

    const series = await getObservationsByCodesInRange(query.categories, {
      from: query.from,
      to: query.to,
    });

    const response = CpiResponseSchema.parse({ series });
    return NextResponse.json(response);
  } catch (error) {
    return toErrorResponse(error);
  }
}
