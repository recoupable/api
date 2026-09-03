/** The 768p unit multiplier, confirmed live: a 5s/768P request billed 8 units. */
const RESOLUTION_768P_UNIT_MULTIPLIER = 1.6;

/**
 * Estimate the billable units a video request will cost, before fal has
 * actually run it — used for the pre-flight credit check and as a fallback
 * when the real count (`getFalBillableUnits`) can't be read after
 * generation.
 *
 * fal doesn't bill 768p at a different `unit_price`; it scales the unit
 * count by 1.6x instead — confirmed live, a 5s/768P request billed 8 units.
 *
 * @param durationSeconds - Requested `duration`.
 * @param resolution - Requested `resolution`.
 * @returns Estimated billable units.
 */
export function estimateVideoUnits(durationSeconds: number, resolution: "480P" | "768P"): number {
  return resolution === "768P"
    ? durationSeconds * RESOLUTION_768P_UNIT_MULTIPLIER
    : durationSeconds;
}
