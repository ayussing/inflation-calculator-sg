// Laspeyres-style fixed-basket personal inflation calculation. Pure, no I/O — callers resolve
// spend + categoryCode into CPI index values via lib/cpi/ before calling this module.

export type CategoryObservation = {
  categoryCode: string;
  spend: number; // must be >= 0
  cpiStart: number; // index value at period start; must be > 0
  cpiEnd: number; // index value at period end; must be > 0
};

export type NormalizedWeight = {
  categoryCode: string;
  weight: number; // full-precision fraction; sums to 1 across a basket
};

export type CategoryContribution = {
  categoryCode: string;
  weight: number;
  displayWeightPercent: number; // rounded whole percent; sums to exactly 100 across a basket
  categoryPercentChange: number;
  contribution: number; // sums to personalInflationRate across a basket
};

export type PersonalInflationResult = {
  personalInflationRate: number;
  personalIndexStart: number;
  personalIndexEnd: number;
  contributions: CategoryContribution[];
};

export class MissingCpiObservationError extends Error {
  constructor(
    public readonly categoryCode: string,
    public readonly period: "start" | "end"
  ) {
    super(`No CPI observation for category "${categoryCode}" at period "${period}"`);
    this.name = "MissingCpiObservationError";
  }
}

export class InvalidCpiValueError extends Error {
  constructor(
    public readonly categoryCode: string,
    public readonly period: "start" | "end",
    public readonly value: number
  ) {
    super(
      `CPI index for "${categoryCode}" at "${period}" must be a positive finite number, got ${value}`
    );
    this.name = "InvalidCpiValueError";
  }
}

export function normalizeWeights(
  categories: { categoryCode: string; spend: number }[]
): NormalizedWeight[] {
  const totalSpend = categories.reduce((sum, c) => sum + c.spend, 0);

  if (!Number.isFinite(totalSpend) || totalSpend <= 0) {
    throw new Error("Total spend must be greater than zero");
  }
  if (categories.some((c) => c.spend < 0)) {
    throw new Error("Spend must not be negative");
  }

  return categories.map((c) => ({
    categoryCode: c.categoryCode,
    weight: c.spend / totalSpend,
  }));
}

// Largest-remainder (Hare-Niemeyer) apportionment: rounds each weight to a whole percentage
// point so the displayed values always sum to exactly 100, instead of drifting to 99 or 101
// from rounding each one independently.
export function toDisplayPercentages(weights: NormalizedWeight[]): number[] {
  const raw = weights.map((w) => w.weight * 100);
  const floors = raw.map((r) => Math.floor(r));
  const remainder = 100 - floors.reduce((sum, f) => sum + f, 0);

  const byRemainingFraction = raw
    .map((r, i) => ({ i, fraction: r - floors[i] }))
    .sort((a, b) => b.fraction - a.fraction)
    .map((entry) => entry.i);

  const result = [...floors];
  for (let k = 0; k < remainder; k++) {
    result[byRemainingFraction[k]] += 1;
  }
  return result;
}

export function calculateCategoryPercentChange(cpiStart: number, cpiEnd: number): number {
  return (cpiEnd / cpiStart - 1) * 100;
}

export function convertPurchasingPower(
  amount: number,
  personalIndexBase: number,
  personalIndexToday: number
): number {
  return amount * (personalIndexToday / personalIndexBase);
}

function validateCpiValue(categoryCode: string, period: "start" | "end", value: number): void {
  if (value === undefined || value === null || Number.isNaN(value)) {
    throw new MissingCpiObservationError(categoryCode, period);
  }
  if (!Number.isFinite(value) || value <= 0) {
    throw new InvalidCpiValueError(categoryCode, period, value);
  }
}

export function calculatePersonalInflation(
  categories: CategoryObservation[]
): PersonalInflationResult {
  categories.forEach((c) => {
    validateCpiValue(c.categoryCode, "start", c.cpiStart);
    validateCpiValue(c.categoryCode, "end", c.cpiEnd);
  });

  const weights = normalizeWeights(categories);
  const displayPercentages = toDisplayPercentages(weights);

  const personalIndexStart = categories.reduce(
    (sum, c, i) => sum + weights[i].weight * c.cpiStart,
    0
  );
  const personalIndexEnd = categories.reduce(
    (sum, c, i) => sum + weights[i].weight * c.cpiEnd,
    0
  );

  const personalInflationRate = (personalIndexEnd / personalIndexStart - 1) * 100;

  const contributions: CategoryContribution[] = categories.map((c, i) => ({
    categoryCode: c.categoryCode,
    weight: weights[i].weight,
    displayWeightPercent: displayPercentages[i],
    categoryPercentChange: calculateCategoryPercentChange(c.cpiStart, c.cpiEnd),
    contribution: ((weights[i].weight * (c.cpiEnd - c.cpiStart)) / personalIndexStart) * 100,
  }));

  return { personalInflationRate, personalIndexStart, personalIndexEnd, contributions };
}
