import { describe, expect, it } from "vitest";
import { PersonalInflationRequestSchema } from "./schema";

describe("PersonalInflationRequestSchema", () => {
  const base = { categories: [{ categoryCode: "all-items/food", spend: 100 }] };

  it("normalizes YYYY-MM from/to into YYYY-MM-01", () => {
    const result = PersonalInflationRequestSchema.parse({ ...base, from: "2023-01", to: "2024-01" });
    expect(result.from).toBe("2023-01-01");
    expect(result.to).toBe("2024-01-01");
  });

  it("rejects a from/to that isn't YYYY-MM", () => {
    expect(() =>
      PersonalInflationRequestSchema.parse({ ...base, from: "2023-01-01", to: "2024-01" })
    ).toThrow();
  });

  it("rejects a reversed from/to range", () => {
    expect(() =>
      PersonalInflationRequestSchema.parse({ ...base, from: "2024-01", to: "2023-01" })
    ).toThrow();
  });

  it("accepts from equal to to", () => {
    expect(() =>
      PersonalInflationRequestSchema.parse({ ...base, from: "2024-01", to: "2024-01" })
    ).not.toThrow();
  });

  it("requires at least one category", () => {
    expect(() =>
      PersonalInflationRequestSchema.parse({ from: "2023-01", to: "2024-01", categories: [] })
    ).toThrow();
  });

  it("rejects a negative spend", () => {
    expect(() =>
      PersonalInflationRequestSchema.parse({
        from: "2023-01",
        to: "2024-01",
        categories: [{ categoryCode: "all-items/food", spend: -1 }],
      })
    ).toThrow();
  });
});
