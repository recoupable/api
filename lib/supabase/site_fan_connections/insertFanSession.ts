import { fanConnectionDatabase } from "./fanConnectionDatabase";
import type { FanSession } from "@/lib/sites/fanConnection/schema";
export async function insertFanSession(session: FanSession) {
  const db = fanConnectionDatabase();
  // Expired authorization attempts contain a PKCE verifier; remove them as traffic arrives.
  const { error: cleanupError } = await db
    .from("site_fan_oauth_sessions")
    .delete()
    .lt("expires_at", new Date().toISOString());
  if (cleanupError) throw new Error("Could not expire fan connection sessions");
  const { error } = await db.from("site_fan_oauth_sessions").insert(session);
  if (error) throw new Error("Could not start fan connection");
}
