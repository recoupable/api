/**
 * Turn the documented duration enum (`"4s"`, `"6s"`, `"7s"`, `"8s"`) into a
 * number of seconds for pricing.
 *
 * The contract is a string enum, not an integer — a bare `8` is a 400 — so the
 * credit gate has to parse it rather than read it.
 *
 * @param duration - The validated `duration` value.
 * @returns Seconds, or 0 when it cannot be parsed.
 */
export function parseDurationSeconds(duration: string | undefined): number {
  if (!duration) return 0;
  const seconds = Number.parseFloat(duration);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
}
