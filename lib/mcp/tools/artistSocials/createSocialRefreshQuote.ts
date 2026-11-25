import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const quoteClaims = z.object({ id: z.uuid(), expiresAt: z.number().int() });
const QUOTE_LIFETIME_MS = 10 * 60 * 1000;

/** Bind a short-lived quote to the caller, exact targets, post depth and maximum charge. */
export function createSocialRefreshQuote(scope: {
  accountId: string;
  artistId: string;
  targets: string[];
  posts: number | undefined;
  maximumCredits: number;
}) {
  const key = Buffer.from(process.env.OAUTH_INDEX_KEY ?? "", "base64");
  if (key.length !== 32) throw new Error("Social refresh quote signing unavailable");
  const sign = (payload: string) =>
    createHmac("sha256", key)
      .update(JSON.stringify(["recoup-social-refresh-v1", scope, payload]))
      .digest();

  return {
    issue() {
      const expiresAt = Date.now() + QUOTE_LIFETIME_MS;
      const payload = Buffer.from(JSON.stringify({ id: randomUUID(), expiresAt })).toString(
        "base64url",
      );
      return { token: `${payload}.${sign(payload).toString("base64url")}`, expiresAt };
    },
    verify(token: string) {
      const [payload, mac, extra] = token.split(".");
      if (!payload || !mac || extra !== undefined) return null;
      const actual = Buffer.from(mac, "base64url");
      const expected = sign(payload);
      if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
      const claims = quoteClaims.parse(JSON.parse(Buffer.from(payload, "base64url").toString()));
      return claims.expiresAt > Date.now() ? claims : null;
    },
  };
}
