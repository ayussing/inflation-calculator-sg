import { describe, expect, it } from "vitest";
import {
  InvalidPeriodRangeError,
  NoAvailablePeriodsForRangeError,
  resolvePeriod,
} from "./period";

describe("resolvePeriod", () => {
  it("resolves an exact match unchanged with no warnings", () => {
    const result = resolvePeriod(
      { from: "2024-01-01", to: "2024-06-01" },
      ["2024-01-01", "2024-02-01", "2024-03-01", "2024-04-01", "2024-05-01", "2024-06-01"]
    );

    expect(result).toEqual({ from: "2024-01-01", to: "2024-06-01", warnings: [] });
  });

  it("clamps a `from` earlier than the earliest available period, with a warning", () => {
    const result = resolvePeriod(
      { from: "2020-01-01", to: "2024-03-01" },
      ["2024-01-01", "2024-02-01", "2024-03-01"]
    );

    expect(result.from).toBe("2024-01-01");
    expect(result.to).toBe("2024-03-01");
    expect(result.warnings).toHaveLength(1);
  });

  it("clamps a `to` later than the latest available period (partial year), with a warning", () => {
    const result = resolvePeriod(
      { from: "2024-01-01", to: "2030-12-01" },
      ["2024-01-01", "2024-02-01", "2024-03-01"]
    );

    expect(result.from).toBe("2024-01-01");
    expect(result.to).toBe("2024-03-01");
    expect(result.warnings).toHaveLength(1);
  });

  it("snaps a `from` that falls in a gap forward to the next available period", () => {
    const result = resolvePeriod(
      { from: "2024-02-01", to: "2024-04-01" },
      ["2024-01-01", "2024-03-01", "2024-04-01"]
    );

    expect(result.from).toBe("2024-03-01");
    expect(result.warnings).toHaveLength(1);
  });

  it("snaps a `to` that falls in a gap backward to the prior available period", () => {
    const result = resolvePeriod(
      { from: "2024-01-01", to: "2024-02-01" },
      ["2024-01-01", "2024-03-01", "2024-04-01"]
    );

    expect(result.to).toBe("2024-01-01");
    expect(result.warnings).toHaveLength(1);
  });

  it("throws InvalidPeriodRangeError for a reversed range", () => {
    expect(() =>
      resolvePeriod({ from: "2024-06-01", to: "2024-01-01" }, ["2024-01-01", "2024-06-01"])
    ).toThrow(InvalidPeriodRangeError);
  });

  it("throws NoAvailablePeriodsForRangeError when availablePeriods is empty", () => {
    expect(() => resolvePeriod({ from: "2024-01-01", to: "2024-06-01" }, [])).toThrow(
      NoAvailablePeriodsForRangeError
    );
  });

  it("throws NoAvailablePeriodsForRangeError when the requested range is entirely outside coverage", () => {
    expect(() =>
      resolvePeriod({ from: "2010-01-01", to: "2011-12-01" }, ["2024-01-01", "2024-06-01"])
    ).toThrow(NoAvailablePeriodsForRangeError);
  });

  it("throws NoAvailablePeriodsForRangeError when a gap swallows the entire requested range", () => {
    expect(() =>
      resolvePeriod(
        { from: "2024-02-01", to: "2024-02-01" },
        ["2024-01-01", "2024-04-01"]
      )
    ).toThrow(NoAvailablePeriodsForRangeError);
  });

  it("resolves trivially when availablePeriods has a single element matching from === to", () => {
    const result = resolvePeriod({ from: "2024-01-01", to: "2024-01-01" }, ["2024-01-01"]);
    expect(result).toEqual({ from: "2024-01-01", to: "2024-01-01", warnings: [] });
  });
});
