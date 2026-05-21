/**
 * Pointwise-sum two `number | undefined` token counts. Returns
 * `undefined` only when BOTH inputs are missing — so sparse usage
 * records (where the provider only reported some fields) stay sparse
 * after summation instead of introducing spurious zeros.
 *
 * Mirrors open-agents' internal `addTokenCounts` helper inside
 * `packages/agent/usage.ts`.
 */
export function addTokenCounts(a: number | undefined, b: number | undefined): number | undefined {
  if (a == null && b == null) return undefined;
  return (a ?? 0) + (b ?? 0);
}
