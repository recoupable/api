import { fanConnectionDatabase } from "./fanConnectionDatabase";
import { sessionSchema } from "@/lib/sites/fanConnection/schema";
/** Claim once before token exchange, binding the callback to the initiating browser. */
export async function consumeFanSession(stateHash: string, browserHash: string) {
  const now = new Date().toISOString();
  const { data, error } = await fanConnectionDatabase()
    .from("site_fan_oauth_sessions")
    .update({ consumed_at: now })
    .eq("state_hash", stateHash)
    .eq("browser_hash", browserHash)
    .is("consumed_at", null)
    .gt("expires_at", now)
    .select()
    .maybeSingle();
  if (error) throw new Error("Could not complete fan connection");
  return data ? sessionSchema.parse(data) : null;
}
