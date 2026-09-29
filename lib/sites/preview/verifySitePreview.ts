import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { SiteError } from "../SiteError";
export function verifySitePreview(token: string, siteId: string) {
  try {
    const secret = process.env.SITES_JOB_SECRET || process.env.SUPABASE_KEY;
    if (!secret) throw new Error();
    const [payload, signature, extra] = token.split(".");
    if (!payload || !signature || extra) throw new Error();
    const expected = createHmac("sha256", secret).update(`site-preview-v1:${payload}`).digest();
    const actual = Buffer.from(signature, "base64url");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error();
    const grant = z
      .object({ siteId: z.string().uuid(), accountId: z.string(), expires: z.number() })
      .parse(JSON.parse(Buffer.from(payload, "base64url").toString()));
    if (grant.siteId !== siteId || grant.expires <= Date.now()) throw new Error();
    return grant;
  } catch {
    throw new SiteError(403, "Preview expired. Return to the editor and refresh the preview.");
  }
}
