export function NumberInput({
  id,
  label,
  value,
  onChange,
  min = 0,
  prefix,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  prefix?: string;
}) {
  return (
    <label htmlFor={id} className="flex items-center gap-2">
      <span className="sr-only">{label}</span>
      <span className="flex items-center rounded border border-panel-border bg-background px-2 focus-within:ring-2 focus-within:ring-foreground/30">
        {prefix && <span className="text-sm text-foreground/60">{prefix}</span>}
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={min}
          step="1"
          value={Number.isFinite(value) ? value : ""}
          onChange={(e) => {
            const next = e.target.valueAsNumber;
            onChange(Number.isFinite(next) ? Math.max(min, next) : min);
          }}
          className="w-24 bg-transparent py-1.5 pl-1 text-sm outline-none"
        />
      </span>
    </label>
  );
}
