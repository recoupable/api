export type TriggerRunLike = {
  id: string;
  status?: string | null;
  taskIdentifier?: string | null;
  output?: unknown;
};

export function isCompletedRun(run: TriggerRunLike): boolean {
  return run.status === "COMPLETED";
}
