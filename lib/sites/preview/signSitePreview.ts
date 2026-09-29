import { createHmac } from "node:crypto";
/** Short-lived permission minted only after workspace authorization. */
export function signSitePreview(siteId: string, accountId: string) {
  const secret = process.env.SITES_JOB_SECRET || process.env.SUPABASE_KEY;
  if (!secret) throw new Error("Preview signing unavailable");
  const payload = Buffer.from(
    JSON.stringify({ siteId, accountId, expires: Date.now() + 30 * 60000 }),
  ).toString("base64url");
  return `${payload}.${createHmac("sha256", secret).update(`site-preview-v1:${payload}`).digest("base64url")}`;
}
