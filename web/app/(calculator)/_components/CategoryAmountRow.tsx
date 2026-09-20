"use client";

import { NumberInput } from "@/components/NumberInput";

export function CategoryAmountRow({
  code,
  name,
  checked,
  spend,
  onToggle,
  onSpendChange,
}: {
  code: string;
  name: string;
  checked: boolean;
  spend: number;
  onToggle: (checked: boolean) => void;
  onSpendChange: (spend: number) => void;
}) {
  const inputId = `spend-${code}`;

  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <label htmlFor={`toggle-${code}`} className="flex items-center gap-2 text-sm">
        <input
          id={`toggle-${code}`}
          type="checkbox"
          checked={checked}
          onChange={(e) => onToggle(e.target.checked)}
          className="h-4 w-4 rounded border-panel-border"
        />
        {name}
      </label>
      {checked && (
        <NumberInput id={inputId} label={`Monthly spend on ${name}`} value={spend} onChange={onSpendChange} prefix="S$" />
      )}
    </div>
  );
}
