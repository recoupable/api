import type { NextApiRequest, NextApiResponse } from "next";

export const config = { api: { bodyParser: false, externalResolver: true } };

/** OAuth runtime is opt-in until resource authorization and launch validation are complete. */
export default async function oauth(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-store");
  if (process.env.OAUTH_ENABLED !== "true") {
    res.status(404).end();
    return;
  }
  try {
    const { checkOAuthRateLimit } = await import("../../../lib/oauth/checkOAuthRateLimit");
    const retryAfter = await checkOAuthRateLimit(req);
    if (retryAfter > 0) {
      res.setHeader("Retry-After", String(retryAfter));
      res.status(429).json({ error: "rate_limit_exceeded" });
      return;
    }
    const { getOAuthRuntime } = await import("../../../lib/oauth/getOAuthRuntime");
    await getOAuthRuntime()(req, res);
  } catch {
    console.error("OAuth request unavailable", { event: "oauth_unavailable" });
    if (!res.headersSent) res.status(503).json({ error: "oauth_unavailable" });
    else if (!res.writableEnded) res.end();
  }
}
