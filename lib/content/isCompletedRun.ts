export type TriggerRunLike = {
  id: string;
  status?: string | null;
  taskIdentifier?: string | null;
  output?: unknown;
};

/**
 * Returns true if the given Trigger.dev run has a COMPLETED status.
 *
 * @param run - A Trigger.dev run-like object with an optional status field.
 * @returns Whether the run's status equals "COMPLETED".
 */
export function isCompletedRun(run: TriggerRunLike): boolean {
  return run.status === "COMPLETED";
}
