import { z } from "zod";
import { isDeepStrictEqual } from "node:util";
import { parseFanHostIntent } from "./parseFanHostIntent";
const receiptSchema = z
  .object({
    version: z.literal(1),
    receipt_id: z.string(),
    intent: z.unknown(),
    outcome: z.enum(["host_mapping_selected", "host_mapping_created", "existing_host_linked"]),
    host_account_id: z.string(),
    fan_id: z.string(),
    mapping_revision: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
    recorded_at: z
      .string()
      .refine(
        value =>
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
          Number.isFinite(Date.parse(value)) &&
          new Date(value).toISOString() === value,
        "Use canonical UTC milliseconds",
      ),
  })
  .strict();
/** Compare data only. Even a matching receipt is not authenticated, committed or a login grant. */
export function assertFanHostReceiptMatchesIntent(raw: unknown, expectedIntent: unknown) {
  const expected = parseFanHostIntent(expectedIntent);
  const receipt = receiptSchema.parse(raw);
  const actual = parseFanHostIntent(receipt.intent);
  if (!isDeepStrictEqual(actual, expected)) throw new Error("Receipt intent mismatch");
  // Reuse opaque-ID validation without a second intent schema.
  parseFanHostIntent({ ...expected, operation_id: receipt.receipt_id, fan_id: receipt.fan_id });
  parseFanHostIntent({ ...expected, operation_id: receipt.host_account_id });
  if (receipt.fan_id !== expected.fan_id) throw new Error("Receipt fan mismatch");
  if (expected.purpose === "link_existing_host") {
    if (
      receipt.outcome !== "existing_host_linked" ||
      receipt.host_account_id !== expected.host_account_id ||
      receipt.mapping_revision !== expected.expected_mapping_revision + 1
    )
      throw new Error("Receipt link mismatch");
  } else if (receipt.outcome === "existing_host_linked")
    throw new Error("Receipt purpose mismatch");
  return { ...receipt, intent: actual };
}
