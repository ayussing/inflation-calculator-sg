import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { calculatePersonalInflation } from "./calculate";

// The standout validation test: feed SingStat's official 2024-base "General" household basket
// weights into the calculation engine and confirm the result reproduces the published All Items
// CPI, within a small tolerance. Restricted to periods from Jan 2024 onward -- earlier months
// were aggregated with the pre-2024-base weights and won't reproduce this identity.
type Fixture = {
  weightsPer10000: Record<string, number>;
  periods: Record<string, { allItems: number; divisions: Record<string, number> }>;
};

const fixture: Fixture = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "__fixtures__", "singstat-2024-divisions.json"),
    "utf8"
  )
);

const TOLERANCE_INDEX_POINTS = 0.05;
const TOLERANCE_PERCENTAGE_POINTS = 0.05;

function weightedAllItems(periodDate: string): number {
  const { divisions } = fixture.periods[periodDate];
  const totalWeight = Object.values(fixture.weightsPer10000).reduce((s, w) => s + w, 0);
  const weightedSum = Object.entries(fixture.weightsPer10000).reduce(
    (sum, [division, weight]) => sum + weight * divisions[division],
    0
  );
  return weightedSum / totalWeight;
}

describe("standout validation: official SingStat weights vs published All Items CPI", () => {
  it.each(Object.keys(fixture.periods))(
    "reproduces the published All Items CPI within %s index points at %s",
    (periodDate) => {
      const actual = fixture.periods[periodDate].allItems;
      expect(Math.abs(weightedAllItems(periodDate) - actual)).toBeLessThan(
        TOLERANCE_INDEX_POINTS
      );
    }
  );

  it("calculatePersonalInflation on the full official basket matches the published All Items % change", () => {
    const [startPeriod, endPeriod] = Object.keys(fixture.periods);
    const start = fixture.periods[startPeriod];
    const end = fixture.periods[endPeriod];

    const categories = Object.entries(fixture.weightsPer10000).map(([division, weight]) => ({
      categoryCode: division,
      spend: weight,
      cpiStart: start.divisions[division],
      cpiEnd: end.divisions[division],
    }));

    const result = calculatePersonalInflation(categories);
    const publishedChange = (end.allItems / start.allItems - 1) * 100;

    expect(Math.abs(result.personalInflationRate - publishedChange)).toBeLessThan(
      TOLERANCE_PERCENTAGE_POINTS
    );
  });
});
