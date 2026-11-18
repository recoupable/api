import { parseProjectionRunAuthority } from "../projection/parseProjectionRunAuthority";
import { CONTINUATION_WORKFLOW, streamProtocolSchema } from "./streamProtocol";
import { ContinuationError } from "./ContinuationError";
export type ContinuationScope = {
  runId: string;
  accountId: string;
  chatId: string;
  sessionId: string;
};
/** A trusted current scope plus a configured-World record, never a nested caller claim. */
export function validateContinuationRun(
  record: { runId: string; workflowName: string; expiredAt?: unknown; input: unknown },
  scope: ContinuationScope,
  capability: string | null,
) {
  let input;
  try {
    if (
      record.runId !== scope.runId ||
      record.workflowName !== CONTINUATION_WORKFLOW ||
      record.expiredAt != null
    )
      throw new Error();
    input = parseProjectionRunAuthority(record.input);
    if (
      input.accountId !== scope.accountId ||
      input.chatId !== scope.chatId ||
      input.sessionId !== scope.sessionId
    )
      throw new Error();
    streamProtocolSchema.parse(input.streamProtocol);
  } catch {
    throw new ContinuationError("stream_continuation_evidence_unavailable");
  }
  if (input.streamProtocol === "canonical-base-v1" && capability !== "canonical-base-v1")
    throw new ContinuationError("stream_continuation_upgrade_required");
  return input.streamProtocol;
}
