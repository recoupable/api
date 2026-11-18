import type { UIMessage } from "ai";
import type { StreamProtocol } from "./streamProtocol";
import { ContinuationError } from "./ContinuationError";
/** Server-selected reuse behavior; request bodies cannot override this requirement. */
export function selectStreamProtocol(
  messages: UIMessage[],
  freshSurface: boolean,
  capability: string | null,
): StreamProtocol {
  if (!freshSurface && messages.at(-1)?.role === "assistant") {
    if (capability !== "canonical-base-v1")
      throw new ContinuationError("stream_continuation_upgrade_required");
    return "canonical-base-v1";
  }
  return "unmarked-v1";
}
