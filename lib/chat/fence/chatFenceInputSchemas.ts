import { z } from "zod";
import { chatAdmissionSchema } from "./chatAdmissionSchema";
import { chatExecutionSnapshotSchema } from "./chatExecutionSnapshotSchema";

export const chatFenceIdentitySchema = z
  .object({ chatId: z.string().min(1), effectiveAccount: z.uuid() })
  .strict();
export const fencedTrailingDeleteIntentSchema = chatFenceIdentitySchema
  .extend({
    expectedEpoch: z
      .number()
      .int()
      .min(0)
      .max(Number.MAX_SAFE_INTEGER - 1),
    requestId: z.uuid(),
    anchorId: z.string().min(1),
  })
  .strict();
const epoch = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const retry = { request_id: z.uuid(), expected_epoch: epoch };
const digest = z.string().regex(/^[0-9a-f]{64}$/);
export const chatFenceAdmissionCommandSchema = z
  .object({
    action: z.literal("admit"),
    payload: z
      .object({
        ...retry,
        input_hash: digest,
        admission_envelope: chatAdmissionSchema,
        execution_snapshot: chatExecutionSnapshotSchema,
        admission_canonical: z.string().min(1),
        execution_canonical: z.string().min(1),
      })
      .strict(),
  })
  .strict();
