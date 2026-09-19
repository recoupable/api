import { createHmac } from "node:crypto";
/** A signed locator, not an auth credential; polling still requires account/workspace authorization. */
export function signGenerationJob(runId: string, siteId: string, accountId: string) {
  const secret = process.env.SITES_JOB_SECRET || process.env.SUPABASE_KEY;
  if (!secret) throw new Error("Generation signing key unavailable");
  const payload = Buffer.from(
    JSON.stringify({ runId, siteId, accountId, expires: Date.now() + 7 * 86400000 }),
  ).toString("base64url");
  const signature = createHmac("sha256", secret)
    .update(`sites-generation-v1:${payload}`)
    .digest("base64url");
  return `${payload}.${signature}`;
}
