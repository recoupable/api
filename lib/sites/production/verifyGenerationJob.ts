import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { SiteError } from "../SiteError";
export function verifyGenerationJob(token: string, siteId: string, accountId: string) {
  try {
    const secret = process.env.SITES_JOB_SECRET || process.env.SUPABASE_KEY;
    if (!secret) throw new Error();
    const [payload, signature, extra] = token.split(".");
    if (!payload || !signature || extra) throw new Error();
    const expected = createHmac("sha256", secret).update(`sites-generation-v1:${payload}`).digest();
    const actual = Buffer.from(signature, "base64url");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error();
    const job = z
      .object({ runId: z.string(), siteId: z.string(), accountId: z.string(), expires: z.number() })
      .parse(JSON.parse(Buffer.from(payload, "base64url").toString()));
    if (job.siteId !== siteId || job.accountId !== accountId || job.expires < Date.now())
      throw new Error();
    return job;
  } catch {
    throw new SiteError(404, "Generation not found or expired.");
  }
}
