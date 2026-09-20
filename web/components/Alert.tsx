import type { ReactNode } from "react";

const TONE_CLASSES = {
  info: "border-panel-border bg-panel text-foreground/80",
  warning: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  error: "border-negative/40 bg-negative/10 text-negative",
} as const;

export function Alert({
  tone = "info",
  children,
  action,
}: {
  tone?: keyof typeof TONE_CLASSES;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className={`flex items-start justify-between gap-3 rounded-md border px-3 py-2 text-sm ${TONE_CLASSES[tone]}`}>
      <span>{children}</span>
      {action}
    </div>
  );
}
