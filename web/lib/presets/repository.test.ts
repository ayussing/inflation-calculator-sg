import { describe, expect, it, vi } from "vitest";
import type { QueryFn } from "@/lib/db/client";
import { getAllPresets } from "./repository";

describe("getAllPresets", () => {
  it("groups flat joined rows into presets with nested weights", async () => {
    const queryFn = vi
      .fn()
      .mockResolvedValue([
        { id: 1, name: "Lowest 20%", incomeGroup: "lowest-20", sourceYear: 2024, categoryCode: "all-items/food", weightPer10000: 3000 },
        { id: 1, name: "Lowest 20%", incomeGroup: "lowest-20", sourceYear: 2024, categoryCode: "all-items/transport", weightPer10000: 1500 },
        { id: 2, name: "Highest 20%", incomeGroup: "highest-20", sourceYear: 2024, categoryCode: "all-items/food", weightPer10000: 2000 },
      ]) as unknown as QueryFn;

    const result = await getAllPresets(queryFn);

    expect(result).toEqual([
      {
        id: 1,
        name: "Lowest 20%",
        incomeGroup: "lowest-20",
        sourceYear: 2024,
        weights: [
          { categoryCode: "all-items/food", weightPer10000: 3000 },
          { categoryCode: "all-items/transport", weightPer10000: 1500 },
        ],
      },
      {
        id: 2,
        name: "Highest 20%",
        incomeGroup: "highest-20",
        sourceYear: 2024,
        weights: [{ categoryCode: "all-items/food", weightPer10000: 2000 }],
      },
    ]);
  });

  it("keeps a preset with zero weight rows without producing a phantom weight entry", async () => {
    const queryFn = vi
      .fn()
      .mockResolvedValue([
        { id: 1, name: "Empty Preset", incomeGroup: "general", sourceYear: 2024, categoryCode: null, weightPer10000: null },
      ]) as unknown as QueryFn;

    const result = await getAllPresets(queryFn);

    expect(result).toEqual([
      { id: 1, name: "Empty Preset", incomeGroup: "general", sourceYear: 2024, weights: [] },
    ]);
  });

  it("returns an empty array when there are no presets", async () => {
    const queryFn = vi.fn().mockResolvedValue([]) as unknown as QueryFn;
    expect(await getAllPresets(queryFn)).toEqual([]);
  });
});
