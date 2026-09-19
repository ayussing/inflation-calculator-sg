import { parse } from "csv-parse/sync";

export type ParsedSeries = {
  code: string;
  name: string;
  level: number;
  parentCode: string | null;
};

export type ParsedObservation = {
  seriesCode: string;
  periodDate: string; // 'YYYY-MM-01'
  indexValue: number;
};

export type ParsedCpiData = {
  series: ParsedSeries[]; // top-down order: every parent precedes its children
  observations: ParsedObservation[]; // sorted ascending by periodDate
  warnings: string[];
};

const MONTHS: Record<string, string> = {
  Jan: "01",
  Feb: "02",
  Mar: "03",
  Apr: "04",
  May: "05",
  Jun: "06",
  Jul: "07",
  Aug: "08",
  Sep: "09",
  Oct: "10",
  Nov: "11",
  Dec: "12",
};

function slug(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Pure parser for SingStat's wide-format monthly CPI CSV (DataSeries label column + one column
// per month, newest-first). No I/O — takes CSV text in, returns normalized long-format data out.
export function parseCpiCsv(csvText: string, baseYear: number): ParsedCpiData {
  void baseYear; // threaded through so the orchestrator has one place to read which base this data is on
  const rows: string[][] = parse(csvText, { skip_empty_lines: true, trim: false });
  const [header, ...dataRows] = rows;

  // Column 0 is the "DataSeries" label column; columns 1..N are "YYYYMon" periods (e.g. "2026Jul",
  // no space — verified against the real file), newest-first in the source file. We never rely on
  // column order — each column is tagged with an explicit date parsed from its header, and results
  // below are sorted independently of source order.
  const periodColumns = header
    .map((headerCell, index) => {
      const match = headerCell.trim().match(/^(\d{4})\s*([A-Za-z]{3})$/);
      if (!match || index === 0) return null;
      const [, year, monthAbbr] = match;
      const month = MONTHS[monthAbbr];
      if (!month) return null;
      return { index, periodDate: `${year}-${month}-01` };
    })
    .filter((c): c is { index: number; periodDate: string } => c !== null);

  const series: ParsedSeries[] = [];
  const observations: ParsedObservation[] = [];
  const warnings: string[] = [];
  const seenCodes = new Set<string>();
  // `indent` is the raw leading-space count, used only to detect depth changes between rows (the
  // real file indents 4 spaces per level, but we don't hardcode that — any consistent, increasing
  // indent works). `depth` is the normalized 0,1,2,... hierarchy level stored on each series.
  const stack: { indent: number; depth: number; code: string }[] = [];

  for (const row of dataRows) {
    const label = row[0] ?? "";
    if (label.trim().length === 0) continue; // blank/footnote-ish row, not a real series
    if (row.length !== header.length) {
      warnings.push(`Skipped malformed row (column count mismatch): ${JSON.stringify(row)}`);
      continue;
    }

    const indent = label.length - label.trimStart().length;
    const name = label.trim();

    while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }
    const parent = stack.length > 0 ? stack[stack.length - 1] : null;
    const parentCode = parent?.code ?? null;
    const depth = parent ? parent.depth + 1 : 0;

    let code = parentCode ? `${parentCode}/${slug(name)}` : slug(name);
    if (seenCodes.has(code)) {
      let suffix = 2;
      while (seenCodes.has(`${code}-${suffix}`)) suffix += 1;
      warnings.push(`Duplicate code "${code}" disambiguated as "${code}-${suffix}"`);
      code = `${code}-${suffix}`;
    }
    seenCodes.add(code);
    stack.push({ indent, depth, code });

    series.push({ code, name, level: depth, parentCode });

    for (const { index, periodDate } of periodColumns) {
      const raw = row[index]?.trim() ?? "";
      if (raw === "" || raw.toLowerCase() === "na") continue; // not yet published for this period
      const indexValue = Number(raw);
      if (Number.isNaN(indexValue)) {
        warnings.push(`Skipped non-numeric cell for ${code} at ${periodDate}: "${raw}"`);
        continue;
      }
      observations.push({ seriesCode: code, periodDate, indexValue });
    }
  }

  observations.sort((a, b) => a.periodDate.localeCompare(b.periodDate));

  return { series, observations, warnings };
}
