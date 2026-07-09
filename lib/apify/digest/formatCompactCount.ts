/** Deterministic compact count: 678, 12.3K, 1.2M (trailing .0 stripped). */
export function formatCompactCount(n: number): string {
  if (n < 1000) return String(n);
  const [value, unit] = n < 1_000_000 ? [n / 1000, "K"] : [n / 1_000_000, "M"];
  return `${value.toFixed(1).replace(/\.0$/, "")}${unit}`;
}
