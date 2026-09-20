export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-panel-border/60 ${className}`} />;
}
