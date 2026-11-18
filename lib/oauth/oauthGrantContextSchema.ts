import { z } from "zod";
import { selectedContextSchema } from "./selectedContextSchema";

/** Old verifiers require personal; selected grants must never use that legacy discriminator. */
export const oauthGrantContextSchema = z.discriminatedUnion("context", [
  z
    .object({ context: z.literal("personal") })
    .passthrough()
    .refine(value => !Object.hasOwn(value, "selectedContext")),
  z
    .object({ context: z.literal("selected_context_v1"), selectedContext: selectedContextSchema })
    .passthrough(),
]);
