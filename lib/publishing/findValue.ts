/**
 * First scalar found under any of `keys`, walking nested `data`, `result` and
 * `response` envelopes. Composio action results nest the platform's response
 * differently per action.
 *
 * @param value - An action result.
 * @param keys - Candidate key names, in priority order.
 * @returns The value as a string, or null.
 */
export function findValue(value: unknown, keys: string[]): string | null {
  let current = value;
  for (let depth = 0; depth < 8 && current && typeof current === "object"; depth++) {
    const record = current as Record<string, unknown>;
    for (const key of keys) {
      const found = record[key];
      if (found !== null && found !== undefined && typeof found !== "object") return String(found);
    }
    current = record.data ?? record.result ?? record.response;
  }
  return null;
}
