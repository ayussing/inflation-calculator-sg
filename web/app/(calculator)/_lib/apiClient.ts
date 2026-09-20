import type { z } from "zod";
import type { CpiResponse } from "@/lib/cpi/schema";
import { PersonalInflationRequestSchema, type PersonalInflationResponse } from "@/lib/inflation/schema";
import type { ErrorResponse } from "@/lib/http/apiError";

// Use the schema's *input* type (plain "YYYY-MM" strings) for what the client sends, not its
// z.infer output type (which narrows from/to to the post-transform "YYYY-MM-01" shape).
export type PersonalInflationRequestInput = z.input<typeof PersonalInflationRequestSchema>;

export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

async function toApiRequestError(res: Response): Promise<ApiRequestError> {
  try {
    const body = (await res.json()) as ErrorResponse;
    return new ApiRequestError(res.status, body.message, body.details);
  } catch {
    return new ApiRequestError(res.status, res.statusText || "Request failed");
  }
}

export async function getCpiSeries(
  codes: string[],
  range: { from?: string; to?: string },
  signal?: AbortSignal
): Promise<CpiResponse> {
  const params = new URLSearchParams({ categories: codes.join(",") });
  if (range.from) params.set("from", range.from);
  if (range.to) params.set("to", range.to);

  const res = await fetch(`/api/cpi?${params.toString()}`, { signal });
  if (!res.ok) throw await toApiRequestError(res);
  return (await res.json()) as CpiResponse;
}

export function describeApiError(error: unknown): string {
  if (error instanceof ApiRequestError) {
    switch (error.status) {
      case 400:
        return "Check your date range — the start must be before the end.";
      case 404:
        return "One of the selected categories is no longer available.";
      case 422:
        return "No price data is available for the selected period. Try a different date range.";
      default:
        return "Couldn't load your results — check your connection and try again.";
    }
  }
  return "Couldn't load your results — check your connection and try again.";
}

export async function postPersonalInflation(
  body: PersonalInflationRequestInput,
  signal?: AbortSignal
): Promise<PersonalInflationResponse> {
  const res = await fetch("/api/inflation/personal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw await toApiRequestError(res);
  return (await res.json()) as PersonalInflationResponse;
}
