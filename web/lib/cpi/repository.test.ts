import { describe, expect, it, vi } from "vitest";
import type { QueryFn } from "@/lib/db/client";
import {
  getAvailablePeriods,
  getObservationsByCodesAndPeriods,
  getObservationsByCodesInRange,
  getSeriesByCodes,
} from "./repository";

describe("getSeriesByCodes", () => {
  it("queries with the given codes and returns the rows as-is", async () => {
    const rows = [{ id: 1, code: "all-items", name: "All Items", level: 0, parentId: null, baseYear: 2024 }];
    const queryFn = vi.fn().mockResolvedValue(rows) as unknown as QueryFn;

    const result = await getSeriesByCodes(["all-items"], queryFn);

    expect(result).toEqual(rows);
    expect(queryFn).toHaveBeenCalledWith(expect.stringContaining("WHERE code = ANY($1)"), [
      ["all-items"],
    ]);
  });

  it("returns an empty array without querying when given no codes", async () => {
    const queryFn = vi.fn() as unknown as QueryFn;
    const result = await getSeriesByCodes([], queryFn);
    expect(result).toEqual([]);
    expect(queryFn).not.toHaveBeenCalled();
  });
});

describe("getAvailablePeriods", () => {
  it("returns period dates as strings, sorted by the query", async () => {
    const queryFn = vi
      .fn()
      .mockResolvedValue([{ periodDate: "2024-01-01" }, { periodDate: "2024-02-01" }]) as unknown as QueryFn;

    const result = await getAvailablePeriods("all-items", queryFn);

    expect(result).toEqual(["2024-01-01", "2024-02-01"]);
  });
});

describe("getObservationsByCodesInRange", () => {
  it("casts index_value (returned by pg as a string) to a number", async () => {
    const queryFn = vi
      .fn()
      .mockResolvedValue([
        { categoryCode: "all-items", periodDate: "2024-01-01", indexValue: "101.500" },
      ]) as unknown as QueryFn;

    const result = await getObservationsByCodesInRange(["all-items"], {}, queryFn);

    expect(result).toEqual([{ categoryCode: "all-items", periodDate: "2024-01-01", indexValue: 101.5 }]);
    expect(typeof result[0].indexValue).toBe("number");
  });

  it("adds from/to date-range conditions and params only when provided", async () => {
    const queryFn = vi.fn().mockResolvedValue([]) as unknown as QueryFn;

    await getObservationsByCodesInRange(["all-items"], { from: "2024-01-01", to: "2024-06-01" }, queryFn);

    const [sql, params] = (queryFn as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(sql).toContain("o.period_date >= $2");
    expect(sql).toContain("o.period_date <= $3");
    expect(params).toEqual([["all-items"], "2024-01-01", "2024-06-01"]);
  });

  it("returns an empty array without querying when given no codes", async () => {
    const queryFn = vi.fn() as unknown as QueryFn;
    const result = await getObservationsByCodesInRange([], {}, queryFn);
    expect(result).toEqual([]);
    expect(queryFn).not.toHaveBeenCalled();
  });
});

describe("getObservationsByCodesAndPeriods", () => {
  it("casts index_value to a number", async () => {
    const queryFn = vi
      .fn()
      .mockResolvedValue([
        { categoryCode: "all-items", periodDate: "2024-01-01", indexValue: "100.000" },
      ]) as unknown as QueryFn;

    const result = await getObservationsByCodesAndPeriods(["all-items"], ["2024-01-01"], queryFn);

    expect(result[0].indexValue).toBe(100);
  });

  it("returns an empty array without querying when given no codes or no periods", async () => {
    const queryFn = vi.fn() as unknown as QueryFn;
    expect(await getObservationsByCodesAndPeriods([], ["2024-01-01"], queryFn)).toEqual([]);
    expect(await getObservationsByCodesAndPeriods(["all-items"], [], queryFn)).toEqual([]);
    expect(queryFn).not.toHaveBeenCalled();
  });
});
