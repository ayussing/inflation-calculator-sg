// Resolves a requested {from, to} date range against the periods actually available in the CPI
// store. Pure, no I/O — the route handler supplies availablePeriods (e.g. from the "All Items"
// series' own period list, since `na` means "value missing for that code", not "no such month").

export type ResolvedPeriod = {
  from: string; // "YYYY-MM-01", guaranteed to be a member of availablePeriods
  to: string;
  warnings: string[]; // set when the resolved range differs from what was requested
};

export class InvalidPeriodRangeError extends Error {
  constructor(from: string, to: string) {
    super(`Requested period range is reversed: from "${from}" is after to "${to}"`);
    this.name = "InvalidPeriodRangeError";
  }
}

export class NoAvailablePeriodsForRangeError extends Error {
  constructor(from: string, to: string) {
    super(`No available CPI periods overlap the requested range "${from}" to "${to}"`);
    this.name = "NoAvailablePeriodsForRangeError";
  }
}

export function resolvePeriod(
  requested: { from: string; to: string },
  availablePeriods: string[]
): ResolvedPeriod {
  if (requested.from > requested.to) {
    throw new InvalidPeriodRangeError(requested.from, requested.to);
  }

  const sorted = [...new Set(availablePeriods)].sort();
  if (sorted.length === 0) {
    throw new NoAvailablePeriodsForRangeError(requested.from, requested.to);
  }

  const warnings: string[] = [];

  const resolvedFrom = sorted.find((p) => p >= requested.from);
  if (resolvedFrom === undefined) {
    throw new NoAvailablePeriodsForRangeError(requested.from, requested.to);
  }
  if (resolvedFrom !== requested.from) {
    warnings.push(
      `Requested start "${requested.from}" is not available; using nearest available period "${resolvedFrom}" instead.`
    );
  }

  let resolvedTo: string | undefined;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i] <= requested.to) {
      resolvedTo = sorted[i];
      break;
    }
  }
  if (resolvedTo === undefined) {
    throw new NoAvailablePeriodsForRangeError(requested.from, requested.to);
  }
  if (resolvedTo !== requested.to) {
    warnings.push(
      `Requested end "${requested.to}" is not available; using nearest available period "${resolvedTo}" instead.`
    );
  }

  if (resolvedFrom > resolvedTo) {
    throw new NoAvailablePeriodsForRangeError(requested.from, requested.to);
  }

  return { from: resolvedFrom, to: resolvedTo, warnings };
}
