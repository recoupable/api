import { FatalError } from "workflow";
import type { UIMessage } from "ai";
import { prepareAuthorizedProjectionHistory } from "@/lib/chat/projection/prepareAuthorizedProjectionHistory";
import type { ProjectionAuthority } from "@/lib/chat/projection/ProjectionEvidencePorts";
/** Runs after trusted workflow admission/bind and before any history write or seed. */
export async function prepareProjectionHistoryStep(
  messages: UIMessage[],
  scope: ProjectionAuthority,
) {
  "use step";
  try {
    return await prepareAuthorizedProjectionHistory(messages, scope, AbortSignal.timeout(5000));
  } catch {
    throw new FatalError("Projection history evidence unavailable");
  }
}
