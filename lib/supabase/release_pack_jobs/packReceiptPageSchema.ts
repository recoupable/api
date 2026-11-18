import { z } from "zod";
import { packObservationPayloadSchema } from "./packObservationPayloadSchema";
const uuid = z.uuid().refine(value => value === value.toLowerCase());
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const timestamp = z.iso.datetime({ offset: true });
const conflict = z.strictObject({
  kind: z.enum(["accepted", "completed", "failed"]),
  existing_sha256: hash,
  incoming_sha256: hash,
});
const observation = z
  .strictObject({
    operation_id: uuid,
    kind: z.enum(["accepted", "completed", "failed", "conflict"]),
    payload: z.union([packObservationPayloadSchema, conflict]),
    recorded_at: timestamp,
  })
  .refine(row =>
    row.kind === "conflict" ? "existing_sha256" in row.payload : row.kind === row.payload.kind,
  );
export const packReceiptPageSchema = z.strictObject({
  operations: z
    .array(
      z.strictObject({
        id: uuid,
        owner_id: uuid,
        job_id: uuid,
        asset_id: uuid,
        revision: z.number().int().positive(),
        execution_id: uuid,
        execution_version: z.number().int().positive(),
        workflow_run_id: z.string().min(1).max(200),
        claim_id: uuid,
        attempt: z.number().int().positive(),
        phase: z.string().min(1).max(100),
        provider: z.literal("fal"),
        model: z.string().min(1).max(200),
        input_sha256: hash,
        charge_credits: z.number().int().positive(),
        created_at: timestamp,
        observations: z.array(observation).max(4),
      }),
    )
    .max(100),
  next_cursor: uuid.nullable(),
});
