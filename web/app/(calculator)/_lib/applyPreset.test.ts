import { describe, expect, it } from "vitest";
import type { BasketPreset } from "@/lib/presets/schema";
import { presetToBasket } from "./applyPreset";

const KNOWN_CODES = new Set(["food", "transport", "housing-utilities"]);

const PRESET: BasketPreset = {
  id: 1,
  name: "Median household",
  incomeGroup: "middle",
  sourceYear: 2023,
  weights: [
    { categoryCode: "food", weightPer10000: 3000 },
    { categoryCode: "transport", weightPer10000: 1500 },
    { categoryCode: "housing-utilities", weightPer10000: 5500 },
  ],
};

describe("presetToBasket", () => {
  it("splits total spend across categories proportional to weight", () => {
    const { basket, droppedCodes } = presetToBasket(PRESET, 1000, KNOWN_CODES);

    expect(basket).toEqual([
      { categoryCode: "food", spend: 300 },
      { categoryCode: "transport", spend: 150 },
      { categoryCode: "housing-utilities", spend: 550 },
    ]);
    expect(droppedCodes).toEqual([]);
  });

  it("drops categories the calculator doesn't know about and reports them", () => {
    const preset: BasketPreset = {
      ...PRESET,
      weights: [...PRESET.weights, { categoryCode: "recreation-culture", weightPer10000: 0 }],
    };

    const { basket, droppedCodes } = presetToBasket(preset, 1000, KNOWN_CODES);

    expect(basket.map((e) => e.categoryCode)).toEqual(["food", "transport", "housing-utilities"]);
    expect(droppedCodes).toEqual(["recreation-culture"]);
  });

  it("produces an empty basket for a zero total spend", () => {
    const { basket, droppedCodes } = presetToBasket(PRESET, 0, KNOWN_CODES);

    expect(basket).toEqual([]);
    expect(droppedCodes).toEqual([]);
  });

  it("omits categories that round down to zero spend", () => {
    const preset: BasketPreset = {
      ...PRESET,
      weights: [{ categoryCode: "food", weightPer10000: 1 }],
    };

    const { basket } = presetToBasket(preset, 10, KNOWN_CODES);

    expect(basket).toEqual([]);
  });
});
