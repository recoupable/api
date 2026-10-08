import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
/** Signed object reference bound to an account; it never replaces OAuth authentication. */
export function createOAuthVideoLocator() {
  const key = Buffer.from(process.env.OAUTH_INDEX_KEY ?? "", "base64");
  if (key.length !== 32) throw new Error("Video locator signing unavailable");
  const signature = (payload: string) =>
    createHmac("sha256", key).update(`recoup-oauth-video-v1:${payload}`).digest();
  return {
    sign(videoId: string, accountId: string) {
      const payload = Buffer.from(JSON.stringify({ videoId, accountId })).toString("base64url");
      return `${payload}.${signature(payload).toString("base64url")}`;
    },
    verify(token: string, accountId: string) {
      if (token.length > 4096) throw new Error("Invalid video locator");
      const [payload, mac, extra] = token.split(".");
      if (!payload || !mac || extra) throw new Error("Invalid video locator");
      const expected = signature(payload),
        actual = Buffer.from(mac, "base64url");
      if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
        throw new Error("Invalid video locator");
      const parsed = z
        .object({ videoId: z.string().min(1), accountId: z.string().min(1) })
        .parse(JSON.parse(Buffer.from(payload, "base64url").toString()));
      if (parsed.accountId !== accountId) throw new Error("Video access denied");
      return parsed.videoId;
    },
  };
}
