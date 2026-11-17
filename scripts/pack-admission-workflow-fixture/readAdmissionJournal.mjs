export async function readAdmissionJournal(world, runId) {
  const events = [];
  let cursor;
  do {
    const page = await world.events.list({ runId, pagination: { sortOrder: "asc", cursor } });
    events.push(...page.data);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return events;
}
