"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { CpiSeries } from "@/lib/cpi/schema";
import { Alert } from "@/components/Alert";
import { Card } from "@/components/Card";
import { Skeleton } from "@/components/Skeleton";
import { calculateCategoryPercentChange } from "@/lib/inflation/calculate";
import { describeApiError } from "../_lib/apiClient";
import { decodeExplorerParams, encodeExplorerParams } from "../_lib/basketUrl";
import { isValidYearMonth } from "../_lib/dateRange";
import { useCpiSeriesQuery } from "../_lib/queries";
import { useDebouncedValue } from "../_lib/useDebouncedValue";
import { CategoryIndexChart } from "./CategoryIndexChart";
import { CategoryTree } from "./CategoryTree";

const MAX_SELECTED = 6;

function changesByCode(series: { categoryCode: string; periodDate: string; indexValue: number }[]) {
  const firstByCode = new Map<string, number>();
  const lastByCode = new Map<string, { periodDate: string; indexValue: number }>();
  for (const point of series) {
    if (!firstByCode.has(point.categoryCode)) firstByCode.set(point.categoryCode, point.indexValue);
    const last = lastByCode.get(point.categoryCode);
    if (!last || point.periodDate > last.periodDate) {
      lastByCode.set(point.categoryCode, { periodDate: point.periodDate, indexValue: point.indexValue });
    }
  }
  const changes = new Map<string, number>();
  for (const [code, first] of firstByCode) {
    const last = lastByCode.get(code);
    if (last) changes.set(code, calculateCategoryPercentChange(first, last.indexValue));
  }
  return changes;
}

export function CategoryExplorer({ allCategories }: { allCategories: CpiSeries[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const knownCodes = useMemo(() => new Set(allCategories.map((c) => c.code)), [allCategories]);
  const labelByCode = useMemo(
    () => Object.fromEntries(allCategories.map((c) => [c.code, c.name])),
    [allCategories]
  );

  const { codes, from, to, droppedCodes } = decodeExplorerParams(searchParams, knownCodes);
  const selected = new Set(codes);

  function updateExplorer(next: { codes: string[]; from?: string; to?: string }) {
    const params = encodeExplorerParams(searchParams, next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function handleToggle(code: string) {
    const nextCodes = selected.has(code) ? codes.filter((c) => c !== code) : [...codes, code];
    updateExplorer({ codes: nextCodes, from, to });
  }

  const debounced = useDebouncedValue({ codes, from, to }, 500);
  const query = useCpiSeriesQuery(debounced);
  const changes = query.data ? changesByCode(query.data.series) : new Map<string, number>();
  const codesWithData = query.data ? new Set(query.data.series.map((p) => p.categoryCode)) : new Set<string>();
  const missingCodes = codes.filter((c) => !codesWithData.has(c));

  return (
    <Card>
      <h2 className="text-lg font-semibold">Explore CPI categories</h2>
      <p className="mt-1 text-sm text-foreground/60">
        Compare how up to {MAX_SELECTED} categories&apos; price indices have moved over time.
      </p>

      {droppedCodes.length > 0 && (
        <div className="mt-3">
          <Alert tone="warning">Some categories in this link were unrecognized and were ignored.</Alert>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        <label htmlFor="explore-from" className="flex items-center gap-1">
          From
          <input
            id="explore-from"
            type="month"
            value={from ?? ""}
            onChange={(e) =>
              updateExplorer({ codes, from: e.target.value || undefined, to })
            }
            className="rounded border border-panel-border bg-background px-2 py-1"
          />
        </label>
        <label htmlFor="explore-to" className="flex items-center gap-1">
          To
          <input
            id="explore-to"
            type="month"
            value={to ?? ""}
            onChange={(e) => updateExplorer({ codes, from, to: e.target.value || undefined })}
            className="rounded border border-panel-border bg-background px-2 py-1"
          />
        </label>
        {(from || to) && (
          <button
            type="button"
            onClick={() => updateExplorer({ codes, from: undefined, to: undefined })}
            className="text-foreground/60 underline"
          >
            Reset to full range
          </button>
        )}
        {from && to && isValidYearMonth(from) && isValidYearMonth(to) && from > to && (
          <span className="text-negative">End date must be after start date.</span>
        )}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,220px)_1fr]">
        <CategoryTree
          categories={allCategories}
          selected={selected}
          onToggle={handleToggle}
          maxSelected={MAX_SELECTED}
        />

        <div>
          {codes.length === 0 && (
            <div className="flex h-72 items-center justify-center text-sm text-foreground/60">
              Select a category to see its price history.
            </div>
          )}

          {codes.length > 0 && query.status === "pending" && <Skeleton className="h-72 w-full" />}

          {codes.length > 0 && query.status === "error" && (
            <Alert
              tone="error"
              action={
                <button type="button" onClick={() => query.refetch()} className="shrink-0 font-medium underline">
                  Retry
                </button>
              }
            >
              {describeApiError(query.error)}
            </Alert>
          )}

          {codes.length > 0 && query.status === "success" && (
            <div className={query.isPlaceholderData ? "opacity-60 transition-opacity" : "transition-opacity"}>
              {missingCodes.length > 0 && (
                <div className="mb-2">
                  <Alert tone="info">
                    No data available for {missingCodes.map((c) => labelByCode[c] ?? c).join(", ")} in this range.
                  </Alert>
                </div>
              )}
              <div className="mb-2 flex flex-wrap gap-3 text-xs text-foreground/70">
                {codes
                  .filter((c) => changes.has(c))
                  .map((c) => (
                    <span key={c}>
                      {labelByCode[c] ?? c}: {changes.get(c)! >= 0 ? "+" : ""}
                      {changes.get(c)!.toFixed(1)}%
                    </span>
                  ))}
              </div>
              <CategoryIndexChart codes={codes} series={query.data.series} labelByCode={labelByCode} />
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
