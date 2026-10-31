import { z } from "zod";
import { isCatalogJson } from "../isCatalogJson";

// Structural envelope; missing/unsupported terms become canonical per-line blockers.
export const entitlementInputSchema = z
  .object({
    schema_version: z.literal("1"),
    rules: z
      .array(z.object({ rule_version: z.string().optional() }).catchall(z.unknown()))
      .max(10000)
      .optional(),
    lines: z.array(z.record(z.string(), z.unknown())).max(10000).optional(),
    recoupment_accounts: z.array(z.record(z.string(), z.unknown())).max(10000).optional(),
  })
  .passthrough()
  .refine(isCatalogJson, "Expected finite bounded JSON");
