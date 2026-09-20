"use client";

import type { CpiSeries } from "@/lib/cpi/schema";
import { Card } from "@/components/Card";
import type { BasketEntry } from "../_lib/basketUrl";
import type { RangePreset } from "../_lib/dateRange";
import { BasketAllocationChart } from "./BasketAllocationChart";
import { CategoryAmountRow } from "./CategoryAmountRow";
import { TimeRangeSelector } from "./TimeRangeSelector";

export function SpendingInputForm({
  divisions,
  basket,
  range,
  onBasketChange,
  onRangeChange,
}: {
  divisions: CpiSeries[];
  basket: BasketEntry[];
  range: { preset: RangePreset; from: string; to: string };
  onBasketChange: (next: BasketEntry[]) => void;
  onRangeChange: (next: { preset: RangePreset; from: string; to: string }) => void;
}) {
  const spendByCode = new Map(basket.map((entry) => [entry.categoryCode, entry.spend]));

  function handleToggle(code: string, checked: boolean) {
    if (checked) {
      onBasketChange([...basket, { categoryCode: code, spend: 0 }]);
    } else {
      onBasketChange(basket.filter((entry) => entry.categoryCode !== code));
    }
  }

  function handleSpendChange(code: string, spend: number) {
    onBasketChange(basket.map((entry) => (entry.categoryCode === code ? { ...entry, spend } : entry)));
  }

  const slices = basket
    .map((entry) => {
      const division = divisions.find((d) => d.code === entry.categoryCode);
      return division ? { categoryCode: entry.categoryCode, label: division.name, spend: entry.spend } : null;
    })
    .filter((s): s is { categoryCode: string; label: string; spend: number } => s !== null);

  return (
    <Card>
      <h2 className="text-lg font-semibold">Your monthly spending</h2>
      <p className="mt-1 text-sm text-foreground/60">
        Select the categories you spend on and enter roughly how much you spend each month.
      </p>

      <div className="mt-4">
        <TimeRangeSelector
          idPrefix="basket-range"
          preset={range.preset}
          from={range.from}
          to={range.to}
          onChange={onRangeChange}
        />
      </div>

      <div className="mt-4 divide-y divide-panel-border/60">
        {divisions.map((division) => (
          <CategoryAmountRow
            key={division.code}
            code={division.code}
            name={division.name}
            checked={spendByCode.has(division.code)}
            spend={spendByCode.get(division.code) ?? 0}
            onToggle={(checked) => handleToggle(division.code, checked)}
            onSpendChange={(spend) => handleSpendChange(division.code, spend)}
          />
        ))}
      </div>

      <div className="mt-4">
        <BasketAllocationChart slices={slices} />
      </div>
    </Card>
  );
}
