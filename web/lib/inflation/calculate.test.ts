import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  InvalidCpiValueError,
  MissingCpiObservationError,
  calculateCategoryPercentChange,
  calculatePersonalInflation,
  convertPurchasingPower,
  normalizeWeights,
  toDisplayPercentages,
} from "./calculate";

const EPSILON = 1e-9;

describe("normalizeWeights", () => {
  it("normalizes spends that don't sum to 100 into weights summing to 1", () => {
    const weights = normalizeWeights([
      { categoryCode: "a", spend: 30 },
      { categoryCode: "b", spend: 45 },
      { categoryCode: "c", spend: 12.5 },
    ]);

    const total = weights.reduce((sum, w) => sum + w.weight, 0);
    expect(total).toBeCloseTo(1, 10);
    expect(weights[0].weight).toBeCloseTo(30 / 87.5, 10);
  });

  it("throws when total spend is zero", () => {
    expect(() =>
      normalizeWeights([
        { categoryCode: "a", spend: 0 },
        { categoryCode: "b", spend: 0 },
      ])
    ).toThrow("Total spend must be greater than zero");
  });

  it("throws when total spend is negative", () => {
    expect(() =>
      normalizeWeights([{ categoryCode: "a", spend: -10 }])
    ).toThrow();
  });

  it("rejects a negative individual spend even if the total is positive", () => {
    expect(() =>
      normalizeWeights([
        { categoryCode: "a", spend: -10 },
        { categoryCode: "b", spend: 50 },
      ])
    ).toThrow("Spend must not be negative");
  });

  it("gives a single category a weight of 1", () => {
    const weights = normalizeWeights([{ categoryCode: "a", spend: 42 }]);
    expect(weights).toEqual([{ categoryCode: "a", weight: 1 }]);
  });
});

describe("toDisplayPercentages", () => {
  it("apportions a three-way split so displayed percentages sum to exactly 100", () => {
    const weights = normalizeWeights([
      { categoryCode: "a", spend: 1 },
      { categoryCode: "b", spend: 1 },
      { categoryCode: "c", spend: 1 },
    ]);

    const displayed = toDisplayPercentages(weights);
    expect(displayed.reduce((sum, p) => sum + p, 0)).toBe(100);
    // 33.33/33.33/33.33 -> two categories round up to 34, one stays at 33 (or vice versa),
    // but which one gets the extra point is deterministic given tied remainders.
    expect(displayed.filter((p) => p === 34)).toHaveLength(1);
    expect(displayed.filter((p) => p === 33)).toHaveLength(2);
  });

  it("is deterministic for a fixed input, including under tied remainders", () => {
    const weights = normalizeWeights([
      { categoryCode: "a", spend: 1 },
      { categoryCode: "b", spend: 1 },
      { categoryCode: "c", spend: 1 },
    ]);

    expect(toDisplayPercentages(weights)).toEqual(toDisplayPercentages(weights));
  });

  it("sums to exactly 100 for an uneven split with several categories", () => {
    const weights = normalizeWeights([
      { categoryCode: "a", spend: 17 },
      { categoryCode: "b", spend: 8 },
      { categoryCode: "c", spend: 41 },
      { categoryCode: "d", spend: 3 },
      { categoryCode: "e", spend: 12 },
    ]);

    expect(toDisplayPercentages(weights).reduce((sum, p) => sum + p, 0)).toBe(100);
  });
});

describe("calculateCategoryPercentChange", () => {
  it("computes the percent change between two index values", () => {
    expect(calculateCategoryPercentChange(100, 105)).toBeCloseTo(5, 10);
    expect(calculateCategoryPercentChange(200, 180)).toBeCloseTo(-10, 10);
  });
});

describe("calculatePersonalInflation", () => {
  it("returns the category's own rate when there is a single category", () => {
    const result = calculatePersonalInflation([
      { categoryCode: "food", spend: 500, cpiStart: 100, cpiEnd: 108 },
    ]);

    expect(result.personalInflationRate).toBeCloseTo(8, 10);
    expect(result.contributions[0].contribution).toBeCloseTo(8, 10);
  });

  it("matches a hand-computed two-category example", () => {
    // A: spend 60, 100 -> 105. B: spend 40, 200 -> 220. weights 0.6 / 0.4.
    // personalIndexStart = 0.6*100 + 0.4*200 = 140
    // personalIndexEnd   = 0.6*105 + 0.4*220 = 151
    // rate = (151/140 - 1) * 100 = 7.857142857...%
    const result = calculatePersonalInflation([
      { categoryCode: "a", spend: 60, cpiStart: 100, cpiEnd: 105 },
      { categoryCode: "b", spend: 40, cpiStart: 200, cpiEnd: 220 },
    ]);

    expect(result.personalIndexStart).toBeCloseTo(140, 10);
    expect(result.personalIndexEnd).toBeCloseTo(151, 10);
    expect(result.personalInflationRate).toBeCloseTo((151 / 140 - 1) * 100, 10);

    const [a, b] = result.contributions;
    expect(a.contribution).toBeCloseTo((0.6 * 5 * 100) / 140, 10);
    expect(b.contribution).toBeCloseTo((0.4 * 20 * 100) / 140, 10);
  });

  it("sums category contributions to exactly the total rate for 3+ categories", () => {
    const result = calculatePersonalInflation([
      { categoryCode: "a", spend: 100, cpiStart: 90, cpiEnd: 95 },
      { categoryCode: "b", spend: 250, cpiStart: 150, cpiEnd: 148 },
      { categoryCode: "c", spend: 40, cpiStart: 60, cpiEnd: 66 },
      { categoryCode: "d", spend: 310, cpiStart: 200, cpiEnd: 210 },
    ]);

    const contributionSum = result.contributions.reduce((sum, c) => sum + c.contribution, 0);
    expect(contributionSum).toBeCloseTo(result.personalInflationRate, 9);
  });

  it("throws MissingCpiObservationError naming the category and period when cpiStart is missing", () => {
    expect(() =>
      calculatePersonalInflation([
        { categoryCode: "food", spend: 100, cpiStart: NaN, cpiEnd: 105 },
      ])
    ).toThrow(MissingCpiObservationError);

    try {
      calculatePersonalInflation([
        { categoryCode: "food", spend: 100, cpiStart: NaN, cpiEnd: 105 },
      ]);
    } catch (err) {
      expect(err).toBeInstanceOf(MissingCpiObservationError);
      expect((err as MissingCpiObservationError).categoryCode).toBe("food");
      expect((err as MissingCpiObservationError).period).toBe("start");
    }
  });

  it("throws MissingCpiObservationError for a missing cpiEnd", () => {
    try {
      calculatePersonalInflation([
        { categoryCode: "food", spend: 100, cpiStart: 100, cpiEnd: NaN },
      ]);
      expect.unreachable("expected calculatePersonalInflation to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(MissingCpiObservationError);
      expect((err as MissingCpiObservationError).period).toBe("end");
    }
  });

  it("throws InvalidCpiValueError (not MissingCpiObservationError) for a non-positive index value", () => {
    expect(() =>
      calculatePersonalInflation([
        { categoryCode: "food", spend: 100, cpiStart: 0, cpiEnd: 105 },
      ])
    ).toThrow(InvalidCpiValueError);

    expect(() =>
      calculatePersonalInflation([
        { categoryCode: "food", spend: 100, cpiStart: -5, cpiEnd: 105 },
      ])
    ).toThrow(InvalidCpiValueError);
  });

  it("allows a zero-spend category alongside others without error", () => {
    const result = calculatePersonalInflation([
      { categoryCode: "a", spend: 0, cpiStart: 100, cpiEnd: 200 },
      { categoryCode: "b", spend: 100, cpiStart: 50, cpiEnd: 55 },
    ]);

    expect(result.contributions[0].weight).toBe(0);
    expect(result.contributions[0].contribution).toBe(0);
    expect(result.personalInflationRate).toBeCloseTo(10, 10);
  });
});

describe("convertPurchasingPower", () => {
  it("scales an amount by the ratio of two personal indices", () => {
    expect(convertPurchasingPower(100, 140, 151)).toBeCloseTo((100 * 151) / 140, 10);
  });

  it("round-trips base -> today -> base back to the original amount", () => {
    const converted = convertPurchasingPower(100, 140, 151);
    const roundTripped = convertPurchasingPower(converted, 151, 140);
    expect(roundTripped).toBeCloseTo(100, 9);
  });
});

describe("property-based", () => {
  const categoryArb = fc.record({
    categoryCode: fc.uuid(),
    spend: fc.double({ min: 0, max: 1_000_000, noNaN: true }),
    cpiStart: fc.double({ min: 0.01, max: 1000, noNaN: true }),
    cpiEnd: fc.double({ min: 0.01, max: 1000, noNaN: true }),
  });

  const categoriesArb = fc
    .uniqueArray(categoryArb, { minLength: 1, maxLength: 20, selector: (c) => c.categoryCode })
    .filter((cs) => cs.reduce((s, c) => s + c.spend, 0) > 0);

  // A variant with a spend floor well above the smallest subnormal doubles, so multiplying by
  // the scale factor below can't underflow a nonzero spend to exactly 0.
  const scalableCategoriesArb = fc.uniqueArray(
    fc.record({
      categoryCode: fc.uuid(),
      spend: fc.double({ min: 1e-6, max: 1_000_000, noNaN: true }),
      cpiStart: fc.double({ min: 0.01, max: 1000, noNaN: true }),
      cpiEnd: fc.double({ min: 0.01, max: 1000, noNaN: true }),
    }),
    { minLength: 1, maxLength: 20, selector: (c) => c.categoryCode }
  );

  it("100% of spending in one category makes the result equal that category's own rate", () => {
    fc.assert(
      fc.property(categoriesArb, fc.nat({ max: 19 }), (categories, pick) => {
        const target = pick % categories.length;
        const singled = categories.map((c, i) => ({
          ...c,
          spend: i === target ? 1_000 : 0,
        }));

        const result = calculatePersonalInflation(singled);
        const expected = calculateCategoryPercentChange(
          singled[target].cpiStart,
          singled[target].cpiEnd
        );

        expect(
          Math.abs(result.personalInflationRate - expected)
        ).toBeLessThan(Math.max(EPSILON, Math.abs(expected) * 1e-9));
      })
    );
  });

  it("scaling every spend by the same positive factor leaves the result unchanged", () => {
    fc.assert(
      fc.property(
        scalableCategoriesArb,
        fc.double({ min: 0.0001, max: 1000, noNaN: true }),
        (categories, factor) => {
          const original = calculatePersonalInflation(categories);
          const scaled = calculatePersonalInflation(
            categories.map((c) => ({ ...c, spend: c.spend * factor }))
          );

          const tolerance = Math.max(1e-6, Math.abs(original.personalInflationRate) * 1e-6);
          expect(Math.abs(scaled.personalInflationRate - original.personalInflationRate)).toBeLessThan(
            tolerance
          );
        }
      )
    );
  });

  it("the personal inflation rate always lies between the min and max category rate", () => {
    fc.assert(
      fc.property(categoriesArb, (categories) => {
        const result = calculatePersonalInflation(categories);
        const rates = categories.map((c) => calculateCategoryPercentChange(c.cpiStart, c.cpiEnd));

        const min = Math.min(...rates);
        const max = Math.max(...rates);
        const tolerance = 1e-6;

        expect(result.personalInflationRate).toBeGreaterThanOrEqual(min - tolerance);
        expect(result.personalInflationRate).toBeLessThanOrEqual(max + tolerance);
      })
    );
  });

  it("purchasing power conversion round-trips for arbitrary positive amounts and indices", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.01, max: 1_000_000, noNaN: true }),
        fc.double({ min: 0.01, max: 1000, noNaN: true }),
        fc.double({ min: 0.01, max: 1000, noNaN: true }),
        (amount, indexBase, indexToday) => {
          const converted = convertPurchasingPower(amount, indexBase, indexToday);
          const roundTripped = convertPurchasingPower(converted, indexToday, indexBase);
          const tolerance = Math.max(1e-6, amount * 1e-9);
          expect(Math.abs(roundTripped - amount)).toBeLessThan(tolerance);
        }
      )
    );
  });
});
