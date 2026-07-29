/**
 * Deterministic compact number for the valuation email: 678, 12.3K, 1.2M,
 * 1.4B (trailing .0 stripped). Extends the digest's K/M formatter with a B
 * tier because lifetime catalog stream totals routinely cross a billion.
 */
export function formatCompactNumber(n: number): string {
  const rounded = Math.round(n);
  if (rounded < 1000) return String(rounded);
  const [value, unit] =
    rounded < 1_000_000
      ? [rounded / 1000, "K"]
      : rounded < 1_000_000_000
        ? [rounded / 1_000_000, "M"]
        : [rounded / 1_000_000_000, "B"];
  return `${value.toFixed(1).replace(/\.0$/, "")}${unit}`;
}
