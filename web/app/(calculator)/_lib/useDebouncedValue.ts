import { useEffect, useState } from "react";

/** Reflects `value` after `delayMs` of no further changes. Used to gate when a query's
 * dependencies change, separating "what the user is typing" from "what triggers a fetch". */
export function useDebouncedValue<T>(value: T, delayMs = 500): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timeout);
  }, [value, delayMs]);

  return debounced;
}
