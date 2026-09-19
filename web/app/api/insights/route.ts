import { NextResponse } from "next/server";
import { getInsights } from "@/lib/insights/repository";
import { InsightsResponseSchema } from "@/lib/insights/schema";
import { ApiError, toErrorResponse } from "@/lib/http/apiError";

export async function GET() {
  try {
    const insights = await getInsights();
    if (insights === null) {
      throw new ApiError(503, "No CPI data has been ingested yet");
    }
    const response = InsightsResponseSchema.parse(insights);
    return NextResponse.json(response);
  } catch (error) {
    return toErrorResponse(error);
  }
}
