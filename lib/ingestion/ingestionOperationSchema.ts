import { z } from "zod";
import { ingestionContractSchema } from "./ingestionContractSchema";
import { ingestionFormatSchema } from "./ingestionFormatSchema";
const key = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9._:-]+$/);
export const ingestionOperationSchema = z.discriminatedUnion("action", [
  z
    .strictObject({
      action: z.literal("create"),
      organization_id: z.uuid().optional(),
      dataset_id: z.uuid().optional(),
      idempotency_key: key,
      source: z.discriminatedUnion("kind", [
        z.strictObject({
          kind: z.literal("inline"),
          filename: z.string().min(1).max(200),
          format: ingestionFormatSchema,
          content_base64: z
            .string()
            .min(4)
            .max(2796204)
            .regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/),
        }),
        z.strictObject({ kind: z.literal("connector"), connector_id: key }),
      ]),
      contract: ingestionContractSchema,
    })
    .refine(v => !v.dataset_id || !!v.organization_id, "Datasets require an organization"),
  z.strictObject({
    action: z.literal("datasets"),
    organization_id: z.uuid(),
    limit: z.number().int().min(1).max(50).default(25),
    after: z.uuid().optional(),
  }),
  z.strictObject({
    action: z.literal("imports"),
    organization_id: z.uuid(),
    dataset_id: z.uuid(),
    limit: z.number().int().min(1).max(50).default(25),
    after: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
  }),
  z.strictObject({
    action: z.literal("records"),
    organization_id: z.uuid(),
    dataset_id: z.uuid(),
    job_id: z.string().regex(/^[a-f0-9]{64}$/),
    limit: z.number().int().min(1).max(100).default(25),
    after_row: z.number().int().min(0).max(10000).default(0),
  }),
  z.strictObject({
    action: z.literal("read"),
    organization_id: z.uuid().optional(),
    job_id: z.string().regex(/^[a-f0-9]{64}$/),
  }),
  z.strictObject({
    action: z.literal("artifact"),
    organization_id: z.uuid().optional(),
    job_id: z.string().regex(/^[a-f0-9]{64}$/),
    stage: z.enum(["bronze", "silver", "gold"]),
  }),
  z.strictObject({
    action: z.literal("deliver"),
    organization_id: z.uuid().optional(),
    job_id: z.string().regex(/^[a-f0-9]{64}$/),
    destination_id: key,
    gold_sha256: z.string().regex(/^[a-f0-9]{64}$/),
  }),
]);
