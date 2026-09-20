import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-panel-border bg-panel p-4 sm:p-6 ${className}`}>
      {children}
    </div>
  );
}
