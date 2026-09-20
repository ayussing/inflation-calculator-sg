import { describe, expect, it } from "vitest";
import { decodeCalculatorParams, encodeCalculatorParams, decodeExplorerParams, encodeExplorerParams } from "./basketUrl";

const KNOWN_CODES = new Set(["food", "transport", "housing-utilities"]);
const TODAY = new Date(Date.UTC(2024, 5, 15)); // 2024-06-15

describe("calculator basket URL codec", () => {
  it("round-trips a custom-range basket through encode/decode", () => {
    const state = {
      range: "custom" as const,
      from: "2019-01",
      to: "2024-01",
      basket: [
        { categoryCode: "food", spend: 450 },
        { categoryCode: "transport", spend: 300 },
      ],
    };
    const params = encodeCalculatorParams(new URLSearchParams(), state);
    const decoded = decodeCalculatorParams(params, KNOWN_CODES, TODAY);

    expect(decoded.range).toBe("custom");
    expect(decoded.from).toBe("2019-01");
    expect(decoded.to).toBe("2024-01");
    expect(decoded.basket).toEqual(state.basket);
    expect(decoded.droppedCodes).toEqual([]);
  });

  it("omits from/to for preset ranges and derives them from today", () => {
    const params = encodeCalculatorParams(new URLSearchParams(), {
      range: "12m",
      from: "irrelevant",
      to: "irrelevant",
      basket: [],
    });
    expect(params.has("from")).toBe(false);
    expect(params.has("to")).toBe(false);

    const decoded = decodeCalculatorParams(params, KNOWN_CODES, TODAY);
    expect(decoded.from).toBe("2023-06");
    expect(decoded.to).toBe("2024-06");
  });

  it("drops unknown category codes and reports them", () => {
    const params = new URLSearchParams("range=12m&b=food:100,not-a-real-code:50");
    const decoded = decodeCalculatorParams(params, KNOWN_CODES, TODAY);

    expect(decoded.basket).toEqual([{ categoryCode: "food", spend: 100 }]);
    expect(decoded.droppedCodes).toEqual(["not-a-real-code"]);
  });

  it("falls back to a valid preset when a custom range is inverted", () => {
    const params = new URLSearchParams("range=custom&from=2024-06&to=2019-01");
    const decoded = decodeCalculatorParams(params, KNOWN_CODES, TODAY);

    expect(decoded.range).toBe("12m");
    expect(decoded.from).toBe("2023-06");
    expect(decoded.to).toBe("2024-06");
  });

  it("treats a bare category code (no spend) as zero spend", () => {
    const params = new URLSearchParams("range=12m&b=food");
    const decoded = decodeCalculatorParams(params, KNOWN_CODES, TODAY);
    expect(decoded.basket).toEqual([{ categoryCode: "food", spend: 0 }]);
  });

  it("preserves unrelated explorer params when encoding the basket", () => {
    const current = new URLSearchParams("explore=food,transport&exFrom=2020-01");
    const params = encodeCalculatorParams(current, {
      range: "12m",
      from: "irrelevant",
      to: "irrelevant",
      basket: [{ categoryCode: "food", spend: 100 }],
    });
    expect(params.get("explore")).toBe("food,transport");
    expect(params.get("exFrom")).toBe("2020-01");
  });
});

describe("category explorer URL codec", () => {
  it("round-trips selected codes and an optional range", () => {
    const params = encodeExplorerParams(new URLSearchParams(), {
      codes: ["food", "transport"],
      from: "2018-01",
      to: "2023-01",
    });
    const decoded = decodeExplorerParams(params, KNOWN_CODES);

    expect(decoded.codes).toEqual(["food", "transport"]);
    expect(decoded.from).toBe("2018-01");
    expect(decoded.to).toBe("2023-01");
  });

  it("defaults to full range when from/to are omitted", () => {
    const params = encodeExplorerParams(new URLSearchParams(), { codes: ["food"] });
    const decoded = decodeExplorerParams(params, KNOWN_CODES);

    expect(decoded.from).toBeUndefined();
    expect(decoded.to).toBeUndefined();
  });

  it("drops an inverted explorer range instead of sending it to the API", () => {
    const params = new URLSearchParams("explore=food&exFrom=2023-01&exTo=2018-01");
    const decoded = decodeExplorerParams(params, KNOWN_CODES);
    expect(decoded.from).toBeUndefined();
    expect(decoded.to).toBeUndefined();
  });
});
