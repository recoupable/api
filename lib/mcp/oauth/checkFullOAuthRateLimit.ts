import { createHmac } from "node:crypto";
import { consumeOAuthRateLimit } from "@/lib/supabase/oauth_rate_limits/consumeOAuthRateLimit";
/** Shared per-account minute budgets prevent multiplying provider traffic through new grants. */
export async function checkFullOAuthRateLimit(name: string, accountId: string) {
  const key = Buffer.from(process.env.OAUTH_INDEX_KEY ?? "", "base64");
  const issuer = process.env.OAUTH_ISSUER;
  if (key.length !== 32 || !issuer) throw new Error("OAuth throttling unavailable");
  const hash = (value: string) =>
    createHmac("sha256", key)
      .update(JSON.stringify([issuer, "mcp-tools", value]))
      .digest("hex");
  const retry = await consumeOAuthRateLimit(hash("namespace"), [
    { key: hash(`account:${accountId}`), limit: 120 },
    { key: hash(`account:${accountId}:tool:${name}`), limit: 30 },
  ]);
  if (retry) throw new Error(`Tool rate limit reached; retry in ${retry} seconds`);
}
