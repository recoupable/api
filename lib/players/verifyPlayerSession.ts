import { createHmac, timingSafeEqual } from "node:crypto";
import { playerSessionSchema } from "./schema";
export function verifyPlayerSession(token: string) {
  const key = process.env.PLAYER_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key || token.length > 2048 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(token))
    throw new Error("Invalid session");
  const [body, signature] = token.split(".");
  const expected = createHmac("sha256", key).update(`release-player:v1:${body}`).digest();
  const actual = Buffer.from(signature, "base64url");
  if (
    actual.toString("base64url") !== signature ||
    actual.length !== expected.length ||
    !timingSafeEqual(actual, expected)
  )
    throw new Error("Invalid session");
  const session = playerSessionSchema.parse(JSON.parse(Buffer.from(body, "base64url").toString()));
  if (session.expiresAt <= Date.now() || session.expiresAt > Date.now() + 7200000)
    throw new Error("Expired session");
  return session;
}
