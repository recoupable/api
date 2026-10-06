import { createHmac } from "node:crypto";
import type { IncomingMessage } from "node:http";
import { isIP } from "node:net";
import { consumeOAuthRateLimit } from "../redis/consumeOAuthRateLimit";

/** Limit before provider/identity/storage work without trusting spoofable forwarded headers. */
export async function checkOAuthRateLimit(req: IncomingMessage) {
  const peer = req.socket.remoteAddress;
  const key = Buffer.from(process.env.OAUTH_INDEX_KEY ?? "", "base64");
  const issuer = process.env.OAUTH_ISSUER;
  if (!peer || !isIP(peer) || key.length !== 32 || !issuer)
    throw new Error("OAuth throttling unavailable");
  const hash = (value: string) =>
    createHmac("sha256", key)
      .update(JSON.stringify([issuer, value]))
      .digest("hex");
  const prefix = `recoup:oauth:rate:${hash("namespace")}`;
  const budgets = [
    { key: `${prefix}:all`, limit: 1200 },
    { key: `${prefix}:peer:${hash(peer)}`, limit: 120 },
  ];
  if (req.url?.split("?")[0] === "/api/oauth/reg") {
    budgets.push(
      { key: `${prefix}:registration`, limit: 100 },
      { key: `${prefix}:registration:${hash(peer)}`, limit: 10 },
    );
  }
  return consumeOAuthRateLimit(budgets);
}
