import { z } from "zod";
import { ingestionColumnNameSchema } from "./ingestionFieldSchema";
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const evidence = z.strictObject({
  job_id: digest,
  engine_version: z.string().min(1).max(100),
  source_sha256: digest,
  rows_read: z.number().int().min(0).max(10000),
  rows_output: z.number().int().min(0).max(10000),
  issues: z
    .array(
      z.strictObject({
        code: z.string().min(1).max(64),
        row: z.number().int().positive().optional(),
        field: ingestionColumnNameSchema.optional(),
      }),
    )
    .max(1000),
  issue_count: z.number().int().min(0).max(10000000),
  issues_truncated: z.number().int().min(0).max(10000000),
  controls: z
    .array(
      z.strictObject({
        field: ingestionColumnNameSchema,
        expected: z.string().max(100),
        actual: z.string().max(1000),
        passed: z.boolean(),
      }),
    )
    .max(100),
  silver_sha256: digest,
});
export const ingestionCompletionSchema = z
  .discriminatedUnion("status", [
    evidence.extend({ status: z.literal("ready"), gold_sha256: digest }),
    evidence.extend({ status: z.enum(["held", "rejected"]), gold_sha256: z.null() }),
  ])
  .refine(
    v =>
      v.rows_output <= v.rows_read &&
      v.issue_count - v.issues.length === v.issues_truncated &&
      (v.status !== "ready" || (v.issue_count === 0 && v.controls.every(c => c.passed))),
    "Invalid completion evidence",
  );
