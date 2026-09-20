"use client";

import { Alert } from "@/components/Alert";
import { Card } from "@/components/Card";
import { Skeleton } from "@/components/Skeleton";
import { describeApiError } from "../_lib/apiClient";
import type { BasketEntry } from "../_lib/basketUrl";
import { useDebouncedValue } from "../_lib/useDebouncedValue";
import { usePersonalInflationQuery } from "../_lib/queries";
import { ContributionBreakdown } from "./ContributionBreakdown";

export function ResultsPanel({
  from,
  to,
  categories,
  categoryLabels,
}: {
  from: string;
  to: string;
  categories: BasketEntry[];
  categoryLabels: Record<string, string>;
}) {
  const hasBasket = categories.length > 0 && categories.some((c) => c.spend > 0);
  const debounced = useDebouncedValue({ from, to, categories }, 500);
  const query = usePersonalInflationQuery(debounced);

  return (
    <Card>
      <h2 className="text-lg font-semibold">Your results</h2>

      {!hasBasket && (
        <div className="mt-4">
          <Alert tone="info">Add a category and an amount above to see your personal inflation rate.</Alert>
        </div>
      )}

      {hasBasket && query.status === "pending" && (
        <div className="mt-4 space-y-3">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}

      {hasBasket && query.status === "error" && (
        <div className="mt-4">
          <Alert
            tone="error"
            action={
              <button
                type="button"
                onClick={() => query.refetch()}
                className="shrink-0 font-medium underline"
              >
                Retry
              </button>
            }
          >
            {describeApiError(query.error)}
          </Alert>
        </div>
      )}

      {hasBasket && query.status === "success" && (
        <div className={`mt-4 space-y-4 transition-opacity ${query.isPlaceholderData ? "opacity-60" : ""}`}>
          <ResultsSummary
            personalRate={query.data.personalInflationRate}
            headlineRate={query.data.headlineInflationRate}
            contributions={query.data.contributions}
            categoryLabels={categoryLabels}
          />
          {query.data.resolvedPeriod.warnings.length > 0 && (
            <Alert tone="warning">{query.data.resolvedPeriod.warnings.join(" ")}</Alert>
          )}
          <ContributionBreakdown contributions={query.data.contributions} categoryLabels={categoryLabels} />
        </div>
      )}
    </Card>
  );
}

function ResultsSummary({
  personalRate,
  headlineRate,
  contributions,
  categoryLabels,
}: {
  personalRate: number;
  headlineRate: number;
  contributions: { categoryCode: string; contribution: number }[];
  categoryLabels: Record<string, string>;
}) {
  const tone = personalRate > headlineRate ? "text-negative" : "text-positive";

  const top = contributions.slice().sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))[0];
  const share =
    top && personalRate !== 0 ? Math.round((top.contribution / personalRate) * 100) : null;

  return (
    <div>
      <p className="text-2xl font-semibold">
        Your inflation: <span className={tone}>{personalRate.toFixed(1)}%</span>{" "}
        <span className="text-base font-normal text-foreground/60">
          vs official {headlineRate.toFixed(1)}%
        </span>
      </p>
      {top && share !== null && Number.isFinite(share) && (
        <p className="mt-1 text-sm text-foreground/70">
          {categoryLabels[top.categoryCode] ?? top.categoryCode} drove {share}% of your inflation.
        </p>
      )}
    </div>
  );
}
