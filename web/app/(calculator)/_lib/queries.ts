import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getCpiSeries, postPersonalInflation } from "./apiClient";
import type { BasketEntry } from "./basketUrl";

/** The one place components get server data from — no component calls fetch/apiClient directly. */

function basketKey(categories: BasketEntry[]): string {
  return categories
    .slice()
    .sort((a, b) => a.categoryCode.localeCompare(b.categoryCode))
    .map((c) => `${c.categoryCode}:${c.spend}`)
    .join(",");
}

export function usePersonalInflationQuery(params: { from: string; to: string; categories: BasketEntry[] }) {
  const hasPositiveSpend = params.categories.some((c) => c.spend > 0);

  return useQuery({
    queryKey: ["personalInflation", params.from, params.to, basketKey(params.categories)],
    queryFn: ({ signal }) =>
      postPersonalInflation(
        { from: params.from, to: params.to, categories: params.categories },
        signal
      ),
    enabled: params.categories.length > 0 && hasPositiveSpend,
    placeholderData: keepPreviousData,
  });
}

export function useCpiSeriesQuery(params: { codes: string[]; from?: string; to?: string }) {
  const sortedCodes = params.codes.slice().sort();

  return useQuery({
    queryKey: ["cpiSeries", sortedCodes.join(","), params.from ?? "", params.to ?? ""],
    queryFn: ({ signal }) => getCpiSeries(sortedCodes, { from: params.from, to: params.to }, signal),
    enabled: sortedCodes.length > 0,
    placeholderData: keepPreviousData,
  });
}
