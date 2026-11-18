import { z } from "zod";
import { workspaceSelectionSchema } from "./workspaceSelectionSchema";

const schema = z
  .object({
    decision: z.enum(["approve", "deny"]),
    csrf: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  })
  .strict();

/** The browser may decide, but cannot choose the account, client, or permissions. */
export function validateOAuthConsentBody(body: unknown) {
  return z
    .union([
      schema,
      ...workspaceSelectionSchema.options.map(selection =>
        schema.extend({ consent_version: z.literal(2), ...selection.shape }).strict(),
      ),
    ])
    .parse(body);
}
