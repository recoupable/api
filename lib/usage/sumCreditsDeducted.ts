/**
 * Total charge across usage rows, in whole credits (micro-dollars).
 *
 * @param rows - Any rows carrying `credits_deducted`.
 * @returns The sum, 0 for no rows.
 */
export function sumCreditsDeducted(rows: ReadonlyArray<{ credits_deducted: number }>): number {
  return rows.reduce((total, row) => total + row.credits_deducted, 0);
}
