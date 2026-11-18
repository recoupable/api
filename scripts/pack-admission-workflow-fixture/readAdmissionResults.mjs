import assert from "node:assert/strict";
import { hydrateStepReturnValue } from "@workflow/core/serialization";
export async function readAdmissionResults(events, runId) {
  let startClock;
  const observations = [];
  for (const created of events.filter(e => e.eventType === "step_created")) {
    const completed = events.find(
      e => e.eventType === "step_completed" && e.correlationId === created.correlationId,
    );
    if (!completed) continue;
    const result = await hydrateStepReturnValue(completed.eventData.result, runId, undefined);
    if (created.eventData.stepName.endsWith("//startPackAdmissionStep")) startClock = result;
    if (created.eventData.stepName.endsWith("//readPackAdmissionStep")) observations.push(result);
  }
  assert(startClock, "start clock must be journaled before restart");
  return { startClock, observations };
}
