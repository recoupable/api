import { writeFile } from "node:fs/promises";
import { join } from "node:path";
export async function writeAdmissionReceipt(effects, result) {
  await writeFile(
    join(effects, "result.json"),
    JSON.stringify({
      ...result,
      journal: result.journal.map(e => ({
        eventType: e.eventType,
        eventId: e.eventId,
        correlationId: e.correlationId,
        stepName: e.eventData?.stepName,
        resumeAt: e.eventData?.resumeAt,
      })),
      startCount: 1,
      replay:
        "Completed start clock preserved; distinct read step IDs exactly once across restart and terminal replay",
    }),
  );
}
