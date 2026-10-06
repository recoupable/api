import type { NextApiRequest, NextApiResponse } from "next";
export const config = { api: { bodyParser: false, externalResolver: true } };
/** Mirror the provider's discovery at the RFC 8414 path for a path-based issuer. */
export default async function discovery(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-store");
  if (process.env.OAUTH_ENABLED !== "true") return res.status(404).end();
  if (req.method !== "GET" && req.method !== "OPTIONS") return res.status(405).end();
  const original = req.url;
  try {
    const { getOAuthRuntime } = await import("../../lib/oauth/getOAuthRuntime");
    req.url = "/api/oauth/.well-known/oauth-authorization-server";
    await getOAuthRuntime().handler(req, res);
  } catch {
    if (!res.headersSent) res.status(503).json({ error: "oauth_unavailable" });
    else if (!res.writableEnded) res.end();
  } finally {
    req.url = original;
  }
}
