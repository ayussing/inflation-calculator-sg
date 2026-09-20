"use client";

import { useMemo, useState } from "react";
import type { CpiSeries } from "@/lib/cpi/schema";
import { Alert } from "@/components/Alert";
import { NumberInput } from "@/components/NumberInput";
import { presetToBasket } from "../_lib/applyPreset";
import type { BasketEntry } from "../_lib/basketUrl";
import { usePresetsQuery } from "../_lib/queries";

export function PresetPicker({
  divisions,
  onApply,
}: {
  divisions: CpiSeries[];
  onApply: (basket: BasketEntry[]) => void;
}) {
  const query = usePresetsQuery();
  const [totalSpend, setTotalSpend] = useState(0);
  const [selectedPresetId, setSelectedPresetId] = useState<number | null>(null);
  const [droppedCodes, setDroppedCodes] = useState<string[]>([]);

  const knownCodes = useMemo(() => new Set(divisions.map((d) => d.code)), [divisions]);
  const categoryLabels = useMemo(
    () => Object.fromEntries(divisions.map((d) => [d.code, d.name])),
    [divisions]
  );

  if (query.status === "pending") {
    return <p className="text-sm text-foreground/60">Loading presets…</p>;
  }

  if (query.status === "error" || query.data.presets.length === 0) {
    return null;
  }

  const presets = query.data.presets;
  const selectedPreset = presets.find((p) => p.id === selectedPresetId) ?? null;
  const canApply = selectedPreset !== null && totalSpend > 0;

  function handleApply() {
    if (!selectedPreset) return;
    const { basket, droppedCodes: dropped } = presetToBasket(selectedPreset, totalSpend, knownCodes);
    onApply(basket);
    setDroppedCodes(dropped);
  }

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">Quick start: apply a preset</h3>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <NumberInput
          id="preset-total-spend"
          label="Your total monthly spend"
          value={totalSpend}
          onChange={setTotalSpend}
          prefix="S$"
        />
        <label htmlFor="preset-select" className="flex items-center gap-1">
          <span className="sr-only">Preset</span>
          <select
            id="preset-select"
            value={selectedPresetId ?? ""}
            onChange={(e) => setSelectedPresetId(e.target.value ? Number(e.target.value) : null)}
            className="rounded border border-panel-border bg-background px-2 py-1.5"
          >
            <option value="">Choose a preset…</option>
            {presets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name} — {preset.incomeGroup} income, {preset.sourceYear}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={handleApply}
          disabled={!canApply}
          className="rounded border border-panel-border bg-panel px-3 py-1.5 font-medium disabled:cursor-not-allowed disabled:opacity-50"
        >
          Apply preset
        </button>
      </div>
      {droppedCodes.length > 0 && (
        <Alert tone="warning">
          This preset also covers{" "}
          {droppedCodes.map((code) => categoryLabels[code] ?? code).join(", ")}, which
          {droppedCodes.length === 1 ? " isn't" : " aren't"} available here, so{" "}
          {droppedCodes.length === 1 ? "it was" : "they were"} left out.
        </Alert>
      )}
    </div>
  );
}
