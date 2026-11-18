import type { getWorld } from "workflow/runtime";
import { hydrateProjectionEvidence } from "../projection/hydrateProjectionEvidence";
import { readProjectionEvidence } from "../projection/readProjectionEvidence";
import { assertBoundedRunData } from "./assertBoundedRunData";
import { encodeBoundedContinuationValue } from "./encodeBoundedContinuationValue";
import { ContinuationError } from "./ContinuationError";
/** Only configured World/key resolution; no stream reads, caller key, fallback or retries. */
export async function readContinuationRun(
  world: Pick<ReturnType<typeof getWorld>, "runs" | "getEncryptionKeyForRun">,
  runId: string,
  signal: AbortSignal,
) {
  try {
    const run = await readProjectionEvidence(
      () => world.runs.get(runId, { resolveData: "all" }),
      signal,
    );
    if (run.runId !== runId || run.expiredAt != null) throw new Error();
    assertBoundedRunData(run.input);
    const input = await readProjectionEvidence(
      () => hydrateProjectionEvidence(run.input, runId, world, signal, run),
      signal,
    );
    encodeBoundedContinuationValue(input, {
      maxBytes: 16_777_216,
      maxDepth: 64,
      maxValues: 250_000,
      omitUndefined: true,
    });
    return { runId: run.runId, workflowName: run.workflowName, expiredAt: run.expiredAt, input };
  } catch {
    throw new ContinuationError("stream_continuation_evidence_unavailable");
  }
}
