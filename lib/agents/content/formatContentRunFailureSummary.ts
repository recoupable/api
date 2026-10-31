/** Formats observed per-run failures without changing the batch's terminal status. */
export function formatContentRunFailureSummary(failedCount: number, timedOutCount: number): string {
  return [
    failedCount > 0 ? `${failedCount} run(s) failed` : "",
    timedOutCount > 0 ? `${timedOutCount} run(s) timed out` : "",
  ]
    .filter(Boolean)
    .join(", ");
}
