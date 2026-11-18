import { errorResponse } from "@/lib/networking/errorResponse";
import { readContinuationRun } from "./readContinuationRun";
import { validateContinuationRun, type ContinuationScope } from "./validateContinuationRun";
import { CONTINUATION_HEADER } from "./streamProtocol";
import { ContinuationError } from "./ContinuationError";
/** Gate before any reader/tail/terminal response; failure never mutates the admitted run. */
export async function gateStoredContinuation(
  request: Request,
  scope: ContinuationScope,
  admission: "admitted" | "existing",
) {
  try {
    const { getWorld } = await import("workflow/runtime");
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(5_000)]);
    const record = await readContinuationRun(getWorld(), scope.runId, signal);
    validateContinuationRun(record, scope, request.headers.get(CONTINUATION_HEADER));
    return null;
  } catch (error) {
    const code =
      error instanceof ContinuationError ? error.code : "stream_continuation_evidence_unavailable";
    return errorResponse(code, code === "stream_continuation_upgrade_required" ? 409 : 503, {
      admission,
      runId: scope.runId,
    });
  }
}
