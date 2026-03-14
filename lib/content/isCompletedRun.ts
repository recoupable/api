export type TriggerRunLike = {
  id: string;
  status?: string | null;
  taskIdentifier?: string | null;
  output?: unknown;
};

/**
 *
 * @param run
 */
export function isCompletedRun(run: TriggerRunLike): boolean {
  return run.status === "COMPLETED";
}
