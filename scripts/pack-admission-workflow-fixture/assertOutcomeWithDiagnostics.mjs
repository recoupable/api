import { assertOutcome } from "./assertOutcome.mjs";
/** Preserve synthetic evidence in CI output before the parent removes its temporary world. */
export function assertOutcomeWithDiagnostics(evidence) {
  const { scenario, runId, state, trace, journal, value, startClock, observations } = evidence;
  try {
    assertOutcome(scenario, runId, state, trace, journal, value, startClock, observations);
  } catch (error) {
    console.error(
      "PACK_ADMISSION_ASSERTION_FAILURE",
      JSON.stringify({
        schema: 1,
        scenario,
        runId,
        state,
        trace,
        value,
        startClock,
        observations,
        journal: journal.map(event => ({
          eventId: event.eventId,
          eventType: event.eventType,
          correlationId: event.correlationId,
          createdAt: event.createdAt,
          stepName: event.eventData?.stepName,
          resumeAt: event.eventData?.resumeAt,
        })),
      }),
    );
    throw error;
  }
}
