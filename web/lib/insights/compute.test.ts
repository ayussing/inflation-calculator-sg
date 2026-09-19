import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { calculateVolatility, subtractMonths, subtractYears } from "./compute";

describe("calculateVolatility", () => {
  it("returns 0 for a constant series", () => {
    const observations = [
      { periodDate: "2024-01-01", indexValue: 100 },
      { periodDate: "2024-02-01", indexValue: 100 },
      { periodDate: "2024-03-01", indexValue: 100 },
    ];
    expect(calculateVolatility(observations)).toBe(0);
  });

  it("matches a hand-computed sample stddev for a known short sequence", () => {
    // 100 -> 102 (+2%), 102 -> 99.96 (-2%), so changes = [2, -2], mean = 0,
    // sample variance = ((2-0)^2 + (-2-0)^2) / (2-1) = 8, stddev = sqrt(8)
    const observations = [
      { periodDate: "2024-01-01", indexValue: 100 },
      { periodDate: "2024-02-01", indexValue: 102 },
      { periodDate: "2024-03-01", indexValue: 99.96 },
    ];
    expect(calculateVolatility(observations)).toBeCloseTo(Math.sqrt(8), 6);
  });

  it("returns null for fewer than 3 observations", () => {
    expect(calculateVolatility([])).toBeNull();
    expect(calculateVolatility([{ periodDate: "2024-01-01", indexValue: 100 }])).toBeNull();
    expect(
      calculateVolatility([
        { periodDate: "2024-01-01", indexValue: 100 },
        { periodDate: "2024-02-01", indexValue: 105 },
      ])
    ).toBeNull();
  });

  it("is order-independent (sorts by periodDate internally)", () => {
    const sorted = [
      { periodDate: "2024-01-01", indexValue: 100 },
      { periodDate: "2024-02-01", indexValue: 102 },
      { periodDate: "2024-03-01", indexValue: 99.96 },
    ];
    const shuffled = [sorted[2], sorted[0], sorted[1]];
    expect(calculateVolatility(shuffled)).toBeCloseTo(calculateVolatility(sorted) as number, 10);
  });

  it("property: volatility is always non-negative when defined", () => {
    const observationArb = fc
      .array(
        fc.record({
          month: fc.integer({ min: 0, max: 200 }),
          indexValue: fc.double({ min: 0.01, max: 1000, noNaN: true }),
        }),
        { minLength: 3, maxLength: 30 }
      )
      .map((entries) => {
        const seenMonths = new Set<number>();
        return entries
          .filter((e) => (seenMonths.has(e.month) ? false : (seenMonths.add(e.month), true)))
          .map((e) => ({
            periodDate: `${String(2000 + Math.floor(e.month / 12)).padStart(4, "0")}-${String(
              (e.month % 12) + 1
            ).padStart(2, "0")}-01`,
            indexValue: e.indexValue,
          }));
      });

    fc.assert(
      fc.property(observationArb, (observations) => {
        const volatility = calculateVolatility(observations);
        if (volatility !== null) {
          expect(volatility).toBeGreaterThanOrEqual(0);
        }
      })
    );
  });
});

describe("subtractYears", () => {
  it("subtracts whole years from a YYYY-MM-01 date", () => {
    expect(subtractYears("2024-06-01", 1)).toBe("2023-06-01");
    expect(subtractYears("2024-06-01", 10)).toBe("2014-06-01");
  });
});

describe("subtractMonths", () => {
  it("subtracts months within the same year", () => {
    expect(subtractMonths("2024-06-01", 3)).toBe("2024-03-01");
  });

  it("subtracts months across a year boundary", () => {
    expect(subtractMonths("2024-01-01", 2)).toBe("2023-11-01");
    expect(subtractMonths("2024-06-01", 24)).toBe("2022-06-01");
  });
});
