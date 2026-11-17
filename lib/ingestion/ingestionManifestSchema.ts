import { z } from "zod";
import { ingestionContractSchema, ingestionFormatSchema } from "./schemas";
const digest = z.string().regex(/^[a-f0-9]{64}$/);
export const ingestionManifestSchema = z
  .strictObject({
    job_id: digest,
    dataset_id: z.uuid().optional(),
    input_sha256: digest,
    engine_version: z.string().min(1).max(100),
    scope: z.string().regex(/^(account|organization)\/[a-f0-9-]{36}$/),
    format: ingestionFormatSchema,
    filename: z.string().min(1).max(200),
    bronze_key: z.string(),
    bronze_sha256: digest,
    source: z.discriminatedUnion("kind", [
      z.strictObject({ kind: z.literal("inline") }),
      z.strictObject({ kind: z.literal("connector"), connector_id: z.string().min(1).max(128) }),
    ]),
    contract: ingestionContractSchema,
    created_at: z.iso.datetime(),
  })
  .refine(
    m => m.bronze_key === `${m.scope}/originals/${m.bronze_sha256}`,
    "Original scope mismatch",
  );
