import { type RangePreset, formatYearMonth, isValidYearMonth, presetToRange } from "./dateRange";

export type BasketEntry = { categoryCode: string; spend: number };

export type CalculatorUrlState = {
  range: RangePreset;
  from: string;
  to: string;
  basket: BasketEntry[];
};

export type ExplorerUrlState = {
  codes: string[];
  from?: string;
  to?: string;
};

const VALID_PRESETS: RangePreset[] = ["12m", "5y", "10y", "custom"];

function parseRangePreset(value: string | null): RangePreset {
  return VALID_PRESETS.includes(value as RangePreset) ? (value as RangePreset) : "12m";
}

/** Decodes the calculator's basket + time range from the URL. Unknown category codes are
 * dropped and reported so the UI can surface a one-time notice instead of failing silently. */
export function decodeCalculatorParams(
  searchParams: URLSearchParams,
  knownCodes: ReadonlySet<string>,
  today: Date = new Date()
): CalculatorUrlState & { droppedCodes: string[] } {
  let range = parseRangePreset(searchParams.get("range"));

  let from: string;
  let to: string;
  if (range === "custom") {
    const rawFrom = searchParams.get("from");
    const rawTo = searchParams.get("to");
    if (rawFrom && rawTo && isValidYearMonth(rawFrom) && isValidYearMonth(rawTo) && rawFrom <= rawTo) {
      from = rawFrom;
      to = rawTo;
    } else {
      range = "12m";
      const fallback = presetToRange("12m", today);
      from = fallback.from;
      to = fallback.to;
    }
  } else {
    const computed = presetToRange(range, today);
    from = computed.from;
    to = computed.to;
  }

  const droppedCodes: string[] = [];
  const basket: BasketEntry[] = [];
  const raw = searchParams.get("b");
  if (raw) {
    for (const entry of raw.split(",")) {
      if (!entry) continue;
      const [code, spendRaw] = entry.split(":");
      if (!code) continue;
      if (!knownCodes.has(code)) {
        droppedCodes.push(code);
        continue;
      }
      const spend = spendRaw ? Number(spendRaw) : 0;
      basket.push({ categoryCode: code, spend: Number.isFinite(spend) && spend >= 0 ? spend : 0 });
    }
  }

  return { range, from, to, basket, droppedCodes };
}

/** Applies calculator state onto an existing URLSearchParams, preserving any unrelated
 * (e.g. explorer) params untouched. Returns a new URLSearchParams. */
export function encodeCalculatorParams(
  current: URLSearchParams,
  state: CalculatorUrlState
): URLSearchParams {
  const params = new URLSearchParams(current);
  params.set("range", state.range);

  if (state.range === "custom") {
    params.set("from", state.from);
    params.set("to", state.to);
  } else {
    params.delete("from");
    params.delete("to");
  }

  if (state.basket.length > 0) {
    params.set(
      "b",
      state.basket
        .map((entry) => (entry.spend > 0 ? `${entry.categoryCode}:${entry.spend}` : entry.categoryCode))
        .join(",")
    );
  } else {
    params.delete("b");
  }

  return params;
}

/** Decodes the category explorer's own selection + range, independent of the basket's. */
export function decodeExplorerParams(
  searchParams: URLSearchParams,
  knownCodes: ReadonlySet<string>
): ExplorerUrlState & { droppedCodes: string[] } {
  const droppedCodes: string[] = [];
  const codes: string[] = [];
  const raw = searchParams.get("explore");
  if (raw) {
    for (const code of raw.split(",")) {
      if (!code) continue;
      if (knownCodes.has(code)) codes.push(code);
      else droppedCodes.push(code);
    }
  }

  const rawFrom = searchParams.get("exFrom");
  const rawTo = searchParams.get("exTo");
  const from = rawFrom && isValidYearMonth(rawFrom) ? rawFrom : undefined;
  const to = rawTo && isValidYearMonth(rawTo) ? rawTo : undefined;
  if (from && to && from > to) {
    return { codes, droppedCodes };
  }

  return { codes, from, to, droppedCodes };
}

export function encodeExplorerParams(current: URLSearchParams, state: ExplorerUrlState): URLSearchParams {
  const params = new URLSearchParams(current);

  if (state.codes.length > 0) {
    params.set("explore", state.codes.join(","));
  } else {
    params.delete("explore");
  }

  if (state.from) params.set("exFrom", state.from);
  else params.delete("exFrom");

  if (state.to) params.set("exTo", state.to);
  else params.delete("exTo");

  return params;
}

export { formatYearMonth };
