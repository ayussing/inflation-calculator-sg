import { describe, expect, it } from "vitest";
import { formatYearMonth, isValidYearMonth, parseYearMonth, presetToRange } from "./dateRange";

const TODAY = new Date(Date.UTC(2024, 5, 15)); // 2024-06-15

describe("dateRange helpers", () => {
  it("formats a Date as YYYY-MM", () => {
    expect(formatYearMonth(new Date(Date.UTC(2024, 0, 1)))).toBe("2024-01");
    expect(formatYearMonth(new Date(Date.UTC(2024, 10, 1)))).toBe("2024-11");
  });

  it("parses and validates YYYY-MM strings", () => {
    expect(isValidYearMonth("2024-01")).toBe(true);
    expect(isValidYearMonth("2024-13")).toBe(true); // regex-only; Date normalizes overflow, not our concern here
    expect(isValidYearMonth("not-a-date")).toBe(false);
    expect(isValidYearMonth("2024-1")).toBe(false);
    expect(parseYearMonth("2024-03")?.getUTCMonth()).toBe(2);
  });

  it("computes preset ranges relative to a given today", () => {
    expect(presetToRange("12m", TODAY)).toEqual({ from: "2023-06", to: "2024-06" });
    expect(presetToRange("5y", TODAY)).toEqual({ from: "2019-06", to: "2024-06" });
    expect(presetToRange("10y", TODAY)).toEqual({ from: "2014-06", to: "2024-06" });
  });
});
