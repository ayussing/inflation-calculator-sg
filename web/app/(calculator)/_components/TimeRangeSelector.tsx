"use client";

import { SegmentedControl } from "@/components/SegmentedControl";
import { RANGE_PRESET_OPTIONS, type RangePreset, isValidYearMonth } from "../_lib/dateRange";

export function TimeRangeSelector({
  preset,
  from,
  to,
  onChange,
  idPrefix,
}: {
  preset: RangePreset;
  from: string;
  to: string;
  onChange: (next: { preset: RangePreset; from: string; to: string }) => void;
  idPrefix: string;
}) {
  const rangeInvalid = preset === "custom" && isValidYearMonth(from) && isValidYearMonth(to) && from > to;

  return (
    <div className="flex flex-col gap-2">
      <SegmentedControl
        aria-label="Time range"
        options={RANGE_PRESET_OPTIONS}
        value={preset}
        onChange={(next) => onChange({ preset: next, from, to })}
      />
      {preset === "custom" && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label htmlFor={`${idPrefix}-from`} className="flex items-center gap-1">
            From
            <input
              id={`${idPrefix}-from`}
              type="month"
              value={from}
              onChange={(e) => onChange({ preset, from: e.target.value, to })}
              className="rounded border border-panel-border bg-background px-2 py-1"
            />
          </label>
          <label htmlFor={`${idPrefix}-to`} className="flex items-center gap-1">
            To
            <input
              id={`${idPrefix}-to`}
              type="month"
              value={to}
              onChange={(e) => onChange({ preset, from, to: e.target.value })}
              className="rounded border border-panel-border bg-background px-2 py-1"
            />
          </label>
          {rangeInvalid && <span className="text-negative">End date must be after start date.</span>}
        </div>
      )}
    </div>
  );
}
