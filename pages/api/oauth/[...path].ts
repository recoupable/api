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
    const { getOAuthRuntime } = await import("../../../lib/oauth/getOAuthRuntime");
    await getOAuthRuntime()(req, res);
  } catch {
    if (!res.headersSent) res.status(503).json({ error: "oauth_unavailable" });
    else if (!res.writableEnded) res.end();
  }
}
