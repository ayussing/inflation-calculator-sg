import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseCpiCsv } from "./parseCpiCsv";

const fixtureCsv = fs.readFileSync(
  path.join(__dirname, "__fixtures__", "sample-cpi.csv"),
  "utf8"
);

describe("parseCpiCsv", () => {
  it("derives hierarchy from indentation and builds ancestor-path codes", () => {
    const { series } = parseCpiCsv(fixtureCsv, 2024);

    expect(series.map((s) => s.code)).toEqual([
      "all-items",
      "all-items/food",
      "all-items/food/prepared-meals",
      "all-items/recreation",
      "all-items/recreation/prepared-meals",
    ]);
    expect(series.map((s) => s.level)).toEqual([0, 1, 2, 1, 2]);

    const food = series.find((s) => s.code === "all-items/food");
    const recreation = series.find((s) => s.code === "all-items/recreation");
    expect(food?.parentCode).toBe("all-items");
    expect(recreation?.parentCode).toBe("all-items");
  });

  it("gives repeated labels under different parents distinct codes, not a shared one", () => {
    const { series } = parseCpiCsv(fixtureCsv, 2024);

    const foodMeals = series.find((s) => s.code === "all-items/food/prepared-meals");
    const recreationMeals = series.find(
      (s) => s.code === "all-items/recreation/prepared-meals"
    );
    expect(foodMeals).toBeDefined();
    expect(recreationMeals).toBeDefined();
    expect(foodMeals?.code).not.toBe(recreationMeals?.code);
    expect(foodMeals?.parentCode).toBe("all-items/food");
    expect(recreationMeals?.parentCode).toBe("all-items/recreation");
  });

  it("skips 'na' cells entirely rather than coercing them to 0", () => {
    const { observations } = parseCpiCsv(fixtureCsv, 2024);

    const recreationJan = observations.find(
      (o) => o.seriesCode === "all-items/recreation" && o.periodDate === "2024-01-01"
    );
    expect(recreationJan).toBeUndefined();

    const recreationFeb = observations.find(
      (o) => o.seriesCode === "all-items/recreation" && o.periodDate === "2024-02-01"
    );
    expect(recreationFeb?.indexValue).toBe(100.0);

    // 5 series x 2 periods, minus the one skipped 'na' cell.
    expect(observations).toHaveLength(9);
  });

  it("sorts observations ascending by period regardless of the source's newest-first columns", () => {
    const { observations } = parseCpiCsv(fixtureCsv, 2024);

    const periods = observations.map((o) => o.periodDate);
    const sorted = [...periods].sort((a, b) => a.localeCompare(b));
    expect(periods).toEqual(sorted);
    expect(periods[0]).toBe("2024-01-01");
    expect(periods[periods.length - 1]).toBe("2024-02-01");
  });

  it("produces no warnings for a well-formed fixture", () => {
    const { warnings } = parseCpiCsv(fixtureCsv, 2024);
    expect(warnings).toEqual([]);
  });
});
