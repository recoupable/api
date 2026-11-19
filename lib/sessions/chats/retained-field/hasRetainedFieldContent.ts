/** Recognize the reserved family even if malformed; validation must not become a disclosure bypass. */
export function hasRetainedFieldContent(message: unknown): boolean {
  const pending: unknown[] = [message];
  while (pending.length) {
    const value = pending.pop();
    if (!value || typeof value !== "object") continue;
    if (Array.isArray(value)) {
      for (const child of value) pending.push(child);
      continue;
    }
    const record = value as Record<string, unknown>;
    if (
      (typeof record.type === "string" && record.type.startsWith("data-retained-field-")) ||
      (typeof record.capability === "string" &&
        record.capability.startsWith("retained-field-companion/")) ||
      (typeof record.contract === "string" &&
        record.contract.startsWith("catalog-retained-field-projection/")) ||
      record.mode === "retained_field"
    )
      return true;
    for (const child of Object.values(record)) pending.push(child);
  }
  return false;
}
