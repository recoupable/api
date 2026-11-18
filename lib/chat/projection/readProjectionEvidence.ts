import { ProjectionEvidenceError } from "./ProjectionEvidenceError";
/** Bound the caller even when an SDK metadata promise ignores cancellation; observe late rejection. */
export async function readProjectionEvidence<T>(
  read: () => Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  if (signal.aborted) throw new ProjectionEvidenceError("cancelled");
  let abort: () => void = () => {};
  const cancelled = new Promise<never>((_, reject) => {
    abort = () => reject(new ProjectionEvidenceError("cancelled"));
    signal.addEventListener("abort", abort, { once: true });
  });
  try {
    return await Promise.race([Promise.resolve().then(read), cancelled]);
  } catch (error) {
    if (error instanceof ProjectionEvidenceError) throw error;
    throw new ProjectionEvidenceError("evidence_unavailable");
  } finally {
    signal.removeEventListener("abort", abort);
  }
}
