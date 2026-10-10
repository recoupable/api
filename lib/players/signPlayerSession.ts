import { createHmac } from "node:crypto";
import type { PlayerSession } from "./schema";
/** A signed capability binds reporting and provider connection to one registered player. */
export function signPlayerSession(session: PlayerSession) {
  const key = process.env.PLAYER_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Player sessions are not configured");
  const body = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${body}.${createHmac("sha256", key).update(`release-player:v1:${body}`).digest("base64url")}`;
}
