/** Normalize a valid timestamp to UTC without losing PostgreSQL microseconds. */
export function normalizeUsageTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const fraction = timestamp.match(/\.(\d+)(?:Z|[+-]\d{2}:\d{2})$/)?.[1] ?? "";
  let microseconds = Number(fraction.padEnd(6, "0").slice(0, 6));
  if (fraction.length > 6 && Number(fraction[6]) >= 5) microseconds += 1;
  const second = new Date(
    Math.floor(date.getTime() / 1000) * 1000 + (microseconds === 1000000 ? 1000 : 0),
  );
  return second
    .toISOString()
    .replace(/\.\d{3}Z$/, `.${String(microseconds % 1000000).padStart(6, "0")}Z`);
}
