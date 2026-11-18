import assert from "node:assert/strict";
export async function readAdmissionJournal(world, runId) {
  const events = [];
  const seen = new Map();
  let cursor;
  do {
    const page = await world.events.list({ runId, pagination: { sortOrder: "asc", cursor } });
    for (const event of page.data) {
      if (seen.has(event.eventId))
        assert.deepEqual(
          event,
          seen.get(event.eventId),
          "Same event ID has contradictory payloads",
        );
      seen.set(event.eventId, event);
      events.push(event); // Preserve repeated records; never hide them through deduplication.
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return events;
}
