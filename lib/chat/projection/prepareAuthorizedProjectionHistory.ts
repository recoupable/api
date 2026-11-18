import type { UIMessage } from "ai";
import { prepareProjectionHistory } from "./prepareProjectionHistory";
import { projectionProducers } from "./projectionProducers";
import { ProjectionEvidenceError } from "./ProjectionEvidenceError";
import type { ProjectionAuthority } from "./ProjectionEvidencePorts";
/** Caller has already authenticated current chat/session ownership; locators are never authority. */
export async function prepareAuthorizedProjectionHistory(
  messages: UIMessage[],
  scope: ProjectionAuthority,
  signal: AbortSignal,
) {
  return prepareProjectionHistory(messages, async (observation, message) => {
    if (!projectionProducers.length) throw new ProjectionEvidenceError("producer_mismatch");
    const [{ getWorld }, { createProjectionEvidencePorts }, { verifyProjectionObservation }] =
      await Promise.all([
        import("workflow/runtime"),
        import("./createProjectionEvidencePorts"),
        import("./verifyProjectionObservation"),
      ]);
    return verifyProjectionObservation({
      observation,
      message,
      scope,
      signal,
      producers: projectionProducers,
      ports: createProjectionEvidencePorts({ world: getWorld() }),
    });
  });
}
