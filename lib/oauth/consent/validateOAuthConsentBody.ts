import { z } from "zod";

const schema = z
  .object({
    decision: z.enum(["approve", "deny"]),
    csrf: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  })
  .strict();

/** The browser may decide, but cannot choose the account, client, or permissions. */
export function validateOAuthConsentBody(body: unknown) {
  return schema.parse(body);
}
