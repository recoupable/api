import { fanConnectionDatabase } from "./fanConnectionDatabase";
import type { FanSession } from "@/lib/sites/fanConnection/schema";
export async function insertFanSession(session: FanSession) {
  const db = fanConnectionDatabase();
  const { error } = await db.from("site_fan_oauth_sessions").insert(session);
  if (error) throw new Error("Could not start fan connection");
}
