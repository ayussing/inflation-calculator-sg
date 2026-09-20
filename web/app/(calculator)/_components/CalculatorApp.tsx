"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { CpiSeries } from "@/lib/cpi/schema";
import { Alert } from "@/components/Alert";
import { decodeCalculatorParams, encodeCalculatorParams, type BasketEntry } from "../_lib/basketUrl";
import type { RangePreset } from "../_lib/dateRange";
import { CategoryExplorer } from "./CategoryExplorer";
import { ResultsPanel } from "./ResultsPanel";
import { SpendingInputForm } from "./SpendingInputForm";

export function CalculatorApp({
  allCategories,
  divisions,
}: {
  allCategories: CpiSeries[];
  divisions: CpiSeries[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [noticeDismissed, setNoticeDismissed] = useState(false);

  const knownCodes = useMemo(() => new Set(divisions.map((d) => d.code)), [divisions]);
  const categoryLabels = useMemo(
    () => Object.fromEntries(allCategories.map((c) => [c.code, c.name])),
    [allCategories]
  );

  const { range, from, to, basket, droppedCodes } = decodeCalculatorParams(searchParams, knownCodes);

  function updateCalculator(next: { range: RangePreset; from: string; to: string; basket: BasketEntry[] }) {
    const params = encodeCalculatorParams(searchParams, next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold">Singapore Personal Inflation Calculator</h1>
        <p className="mt-1 text-sm text-foreground/60">
          See how inflation affects your own spending, compared to Singapore&apos;s official CPI.
        </p>
      </header>

      {droppedCodes.length > 0 && !noticeDismissed && (
        <Alert
          tone="warning"
          action={
            <button type="button" onClick={() => setNoticeDismissed(true)} className="shrink-0 font-medium underline">
              Dismiss
            </button>
          }
        >
          Some categories in this link were unrecognized and were ignored.
        </Alert>
      )}

      <SpendingInputForm
        divisions={divisions}
        basket={basket}
        range={{ preset: range, from, to }}
        onBasketChange={(nextBasket) => updateCalculator({ range, from, to, basket: nextBasket })}
        onRangeChange={(nextRange) =>
          updateCalculator({ range: nextRange.preset, from: nextRange.from, to: nextRange.to, basket })
        }
      />

      <ResultsPanel from={from} to={to} categories={basket} categoryLabels={categoryLabels} />

      <CategoryExplorer allCategories={allCategories} />
    </div>
  );
}
