export type TriggerRunLike = {
  id: string;
  status?: string | null;
  taskIdentifier?: string | null;
  output?: unknown;
};

/**
 * Is Completed Run.
 *
 * @param run - Parameter.
 * @returns - Result.
 */
export function isCompletedRun(run: TriggerRunLike): boolean {
  return run.status === "COMPLETED";
}
