import { z } from "zod";
import { contextOriginalPreparationSchema } from "./contextOriginalPreparationSchema";
const schema = contextOriginalPreparationSchema.extend({
  organizationId: z
    .string()
    .uuid()
    .transform(v => v.toLowerCase())
    .optional(),
  mode: z.enum(["store", "reconcile"]).default("store"),
});
/** Strict transport metadata; raw bytes only in the body. */
export function validateOriginalIntakeQuery(params: URLSearchParams, contentType: string | null) {
  const entries = [...params.entries()];
  if (params.has("mediaType")) throw new Error("Type must come from Content-Type");
  if (new Set(entries.map(([k]) => k)).size !== entries.length)
    throw new Error("Repeated metadata");
  return schema.parse({ ...Object.fromEntries(entries), mediaType: contentType });
}
