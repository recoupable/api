import { fanConnectionDatabase } from "../site_fan_connections/fanConnectionDatabase";
/** Event UUID provides idempotency for browser retries. */
export async function insertSiteActivity(row: {
  id: string;
  site_id: string;
  visit_id: string;
  event: string;
}) {
  const { error } = await fanConnectionDatabase()
    .from("site_activity_events")
    .upsert(row, { onConflict: "id", ignoreDuplicates: true });
  if (error) throw new Error("Could not save site activity");
}
