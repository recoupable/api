export type TriggerRunLike = {
  id: string;
  status?: string | null;
  taskIdentifier?: string | null;
  output?: unknown;
};

/**
 * Is Completed Run.
 *
 * @param run - Value for run.
 * @returns - Computed result.
 */
export function isCompletedRun(run: TriggerRunLike): boolean {
  return run.status === "COMPLETED";
}
