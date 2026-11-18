import { z } from "zod";
import { workspaceSelectionSchema } from "./workspaceSelectionSchema";

const schema = z
  .object({
    decision: z.enum(["approve", "deny"]),
    csrf: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  })
  .strict();

/** Parse decision/workspace choice; server resolution authorizes it and binds identity/scopes. */
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
